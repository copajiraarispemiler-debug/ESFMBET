import * as functions from "firebase-functions";
import admin from "firebase-admin";
admin.initializeApp();

/**
 * Liquidación masiva de apuestas.
 * Nota: Usamos una firma que detecta si viene como v1 o v2 para evitar el error de context null.
 */
export const liquidateMatch = functions.https.onCall(async (dataOrRequest, context) => {
  // Detectamos si es v2 (request.data) o v1 (data directa)
  const data = dataOrRequest && dataOrRequest.data !== undefined ? dataOrRequest.data : dataOrRequest;
  // Detectamos si la auth viene en el primer argumento (v2) o en el segundo (v1)
  const auth = dataOrRequest?.auth || (context && context.auth);

  if (!auth) {
    console.error("Error de Autenticación: No se encontró token de usuario.");
    throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesión para realizar esta acción.');
  }

  const { matchId, homeGoals, awayGoals, penaltyHome, penaltyAway } = data;
  const db = admin.firestore();

  // Verificar rol desde Firestore en lugar del token
  const adminDoc = await db.collection("users").doc(auth.uid).get();
  if (!adminDoc.exists || adminDoc.data().rol !== 'superadmin') {
    console.warn(`Usuario ${auth.uid} intentó liquidar sin permisos.`);
    throw new functions.https.HttpsError('permission-denied', 'Acceso restringido: Se requiere rol de superadmin.');
  }

  try {
    return await db.runTransaction(async (transaction) => {
      // 0. Obtener configuración global de ganancias (Comisión de la casa)
      const settingsRef = db.collection("settings").doc("global");
      const settingsDoc = await transaction.get(settingsRef);
      const profitPercent = settingsDoc.exists ? (Number(settingsDoc.data().profitPercentage) || 100) : 100;
      const profitMultiplier = 1 + (profitPercent / 100);

      const matchRef = db.collection("matches").doc(matchId);
      const matchDoc = await transaction.get(matchRef);

      if (!matchDoc.exists) throw new Error("El partido no existe.");
      if (matchDoc.data().status === 'closed') throw new Error("Este partido ya fue liquidado.");

      const winner = homeGoals > awayGoals ? 'home' : (awayGoals > homeGoals ? 'away' : 'draw');
      const exactKey = `exact_${homeGoals}-${awayGoals}`;

      // 2. Buscar todas las apuestas activas para este partido
      const betsQuery = db.collection("bets")
        .where("matchId", "==", matchId)
        .where("status", "==", "active");
      
      const betsSnap = await transaction.get(betsQuery);

      // Buscar retos que nadie aceptó para eliminarlos (ya que el partido terminó)
      const openBetsQuery = db.collection("bets")
        .where("matchId", "==", matchId)
        .where("status", "==", "open");
      const openBetsSnap = await transaction.get(openBetsQuery);

      betsSnap.forEach((betDoc) => {
        const bet = betDoc.data();
        const creatorRef = db.collection("users").doc(bet.creatorId);
        const isWinner = bet.prediction === winner || bet.prediction === exactKey;
        const isExact = bet.prediction === exactKey;

        if (isWinner) {
          // Regla de Balones
          let balonesPremio = (bet.modality === 'mercado') ? 3 : (bet.modality === 'reto' ? 2 : 1);
          if (isExact) balonesPremio += 1; // El bono de marcador exacto se suma a la base de la modalidad

          transaction.update(creatorRef, {
            balones: admin.firestore.FieldValue.increment(balonesPremio),
            saldo: admin.firestore.FieldValue.increment(bet.betType === 'money' ? Number((bet.valueMoney * profitMultiplier).toFixed(2)) : 0),
            dineroGanado: admin.firestore.FieldValue.increment(bet.betType === 'money' ? (bet.valueMoney * (profitPercent / 100)) : 0),
            "estadisticas.apuestasGanadas": admin.firestore.FieldValue.increment(1)
          });
          transaction.update(betDoc.ref, { status: 'finished', result: 'creator_won' });
        } else {
          // Si perdió el creador y es apuesta libre 1 a 1, el rival gana el pozo
          if (bet.modality === 'libre' && bet.acceptedByIds?.length > 0) {
            const rivalRef = db.collection("users").doc(bet.acceptedByIds[0]);
            transaction.update(rivalRef, {
              balones: admin.firestore.FieldValue.increment(1),
              saldo: admin.firestore.FieldValue.increment(bet.betType === 'money' ? Number((bet.valueMoney * profitMultiplier).toFixed(2)) : 0),
              dineroGanado: admin.firestore.FieldValue.increment(bet.betType === 'money' ? (bet.valueMoney * (Number(profitPercent) / 100)) : 0),
              "estadisticas.apuestasGanadas": admin.firestore.FieldValue.increment(1)
            });
          }
          transaction.update(creatorRef, {
            dineroPerdido: admin.firestore.FieldValue.increment(bet.betType === 'money' ? bet.valueMoney : 0),
            "estadisticas.apuestasPerdidas": admin.firestore.FieldValue.increment(1)
          });
          transaction.update(betDoc.ref, { status: 'finished', result: 'rival_won' });
        }
      });

      // Eliminar físicamente los retos no aceptados
      openBetsSnap.forEach((openBetDoc) => {
        transaction.delete(openBetDoc.ref);
      });

      // 3. Cerrar el partido oficialmente
      transaction.update(matchRef, {
        status: 'closed',
        result: { homeGoals, awayGoals, winner, penaltyHome: penaltyHome || 0, penaltyAway: penaltyAway || 0 }
      });

      return { success: true, processed: betsSnap.size };
    });
  } catch (error) {
    console.error("Error en liquidación:", error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

export const shareChallenge = functions.https.onRequest(async (req, res) => {
  const path = req.path.split("/");
  const betId = path[path.length - 1];

  if (!betId) {
    return res.status(404).send("Reto no encontrado");
  }

  try {
    const betDoc = await admin.firestore().collection("bets").doc(betId).get();
    
    if (!betDoc.exists) {
      return res.status(404).send("El reto ha expirado o no existe.");
    }

    const bet = betDoc.data();
    const matchDoc = await admin.firestore().collection("matches").doc(bet.matchId).get();
    const match = matchDoc.data();

    const title = `🏆 ¡ESTÁS RETADO POR ${bet.creatorName.toUpperCase()}!`;
    const description = `🔥 ${match.homeTeam} vs ${match.awayTeam} 🔥\n💰 Reto: ${bet.betType === 'money' ? bet.valueMoney + ' Bs.' : bet.valueAction}\n⚽ Predicción: ${bet.prediction.replace('exact_', 'Marcador ')}\n\n¿Tienes lo necesario para ganar? Entra y acepta en ESFM BET.`;
    const image = "https://esfmbet.firebaseapp.com/og-worldcup-share.png"; // Imagen con diseño del mundial y logo

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://esfmbet.firebaseapp.com/challenge/${betId}" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image">
        <script>
          // Redirigir al usuario real a la aplicación de React
          window.location.href = "/challenge/${betId}";
        </script>
      </head>
      <body>
        <p>Cargando reto...</p>
      </body>
      </html>
    `;

    res.status(200).send(html);
  } catch {
    res.status(500).send("Error interno");
  }
});