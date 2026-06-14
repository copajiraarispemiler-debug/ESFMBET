import { useState, useEffect } from "react";
import { db } from "./config";
import { collection, query, where, onSnapshot, doc, runTransaction, arrayUnion } from "firebase/firestore";
import { useAuth } from "./hooks/useAuthHook";
import { Link } from "react-router-dom";
import confetti from 'canvas-confetti';

const BetsWall = () => {
  const { user } = useAuth();
  const [bets, setBets] = useState([]);
  const [matches, setMatches] = useState({});
  const [filterType, setFilterType] = useState("all"); // all, money, action
  const [filterModality, setFilterModality] = useState("all"); // all, libre, reto, accion, mercado

  useEffect(() => {
    // Escuchar partidos para mapear nombres de equipos por ID
    const unsubMatches = onSnapshot(collection(db, "matches"), (snap) => {
      const matchMap = {};
      snap.docs.forEach(doc => matchMap[doc.id] = doc.data());
      setMatches(matchMap);
    });

    // Escuchar solo apuestas en estado 'open' (disponibles)
    const q = query(collection(db, "bets"), where("status", "==", "open"));
    const unsubBets = onSnapshot(q, (snap) => {
      setBets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubMatches(); unsubBets(); };
  }, []);

  const handleAcceptBet = async (bet) => {
    if (!user) return alert("Debes iniciar sesión con Google para aceptar retos.");
    if (bet.creatorId === user.uid) return alert("No puedes aceptar tu propio reto.");

    try {
      await runTransaction(db, async (transaction) => {
        const betRef = doc(db, "bets", bet.id);
        const userRef = doc(db, "users", user.uid);
        
        const betSnap = await transaction.get(betRef);
        const userData = (await transaction.get(userRef)).data();

        if (!betSnap.exists()) throw "El reto ya no existe.";
        if (betSnap.data().status !== 'open') throw "Este reto ya ha sido aceptado por otro jugador.";

        if (bet.betType === 'money') {
          if (userData.saldo < bet.valueMoney) {
            throw `Saldo insuficiente. Necesitas ${bet.valueMoney} Bs. para aceptar este reto.`;
          }
          // Congelar saldo del usuario que acepta (Regla 4)
          transaction.update(userRef, { saldo: userData.saldo - bet.valueMoney });
        }

        // Bloquear apuesta y pasar a activa (Regla 2)
        transaction.update(betRef, {
          status: 'active',
          acceptedByIds: arrayUnion(user.uid),
          acceptedByNames: arrayUnion(user.displayName)
        });
      });

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#ffffff', '#eab308'] // Colores temáticos: verde, blanco, amarillo
      });

      alert("¡Reto aceptado! El sistema ha congelado el monto correspondiente.");
    } catch (error) {
      console.error("Error al aceptar:", error);
      alert(error);
    }
  };

  const getPredictionText = (pred, match) => {
    if (!match) return "...";
    if (pred === 'home') return `Gana ${match.homeTeam}`;
    if (pred === 'away') return `Gana ${match.awayTeam}`;
    if (pred === 'draw') return "Empate";
    if (pred.startsWith('exact_')) {
      const score = pred.split('_')[1];
      return `Marcador Exacto: ${score}`;
    }
    return pred;
  };

  const shareBet = (bet) => {
    const match = matches[bet.matchId];
    const text = `⚽ ¡Te reto en ESFM BET! ⚽\nPartido: ${match?.homeTeam} vs ${match?.awayTeam}\nMi predicción: ${getPredictionText(bet.prediction, match)}\nValor: ${bet.betType === 'money' ? bet.valueMoney + ' Bs.' : bet.valueAction}\n\n¿Aceptas el reto? Dale click aquí: ${window.location.origin}/challenge/${bet.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareOnFacebook = (bet) => {
    const url = `${window.location.origin}/challenge/${bet.id}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
  };

  const filteredBets = bets.filter(b => {
    const match = matches[b.matchId];
    // No mostrar retos si el partido ya está cerrado (liquidado)
    if (match && match.status === 'closed') return false;

    const typeMatch = filterType === "all" || b.betType === filterType;
    const modMatch = filterModality === "all" || b.modality === filterModality;
    return typeMatch && modMatch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-28">
      <header className="py-6 flex flex-col items-center">
        <div className="mb-4">
          <img src="/logo.png" alt="ESFM BET" className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" />
        </div>
        <h1 className="text-3xl font-black italic tracking-tighter mb-6 uppercase text-center">Panel de <span className="text-green-500">Apuestas</span></h1>
        
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {['all', 'money', 'action'].map(t => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${filterType === t ? 'bg-green-500 text-slate-950' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                {t === 'all' ? 'Todos' : t === 'money' ? '💰 Dinero' : '🔥 Acciones'}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {['all', 'libre', 'reto', 'mercado'].map(m => (
              <button key={m} onClick={() => setFilterModality(m)} className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase transition-all ${filterModality === m ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6">
        {filteredBets.length > 0 ? filteredBets.map((bet) => {
          const match = matches[bet.matchId];
          return (
            <div key={bet.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-7 relative overflow-hidden group">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{bet.modality}</span>
                </div>
                <div className={`px-4 py-1.5 rounded-xl text-xs font-black ${bet.betType === 'money' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}`}>
                  {bet.betType === 'money' ? `${bet.valueMoney} Bs.` : '🔥 ACCIÓN'}
                </div>
              </div>

              <h3 className="text-xl font-black mb-1">{match?.homeTeam} vs {match?.awayTeam}</h3>
              <p className="text-[10px] text-slate-500 font-bold mb-5 italic uppercase">Retador: {bet.creatorName}</p>

              <div className="bg-slate-950/50 rounded-3xl p-5 mb-6 border border-slate-800/50">
                <p className="text-[9px] text-slate-500 font-black uppercase mb-2">Su Predicción:</p>
                <p className="text-green-400 font-black text-sm uppercase italic tracking-tighter">{getPredictionText(bet.prediction, match)}</p>
                {bet.betType === 'action' && <p className="mt-3 text-xs italic text-slate-400 border-t border-slate-800 pt-3">Paga con: {bet.valueAction}</p>}
              </div>

              <div className="flex gap-3">
                <button onClick={() => handleAcceptBet(bet)} className="flex-3 bg-white text-slate-950 font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest">ACEPTAR RETO</button>
                <button onClick={() => shareBet(bet)} className="flex-1 bg-slate-800 flex items-center justify-center rounded-2xl hover:bg-slate-700 transition-colors" title="Compartir en WhatsApp">
                  <svg className="w-5 h-5 fill-[#25D366]" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                </button>
                <button onClick={() => shareOnFacebook(bet)} className="flex-1 bg-[#1877F2] flex items-center justify-center rounded-2xl hover:opacity-90 transition-opacity" title="Compartir en Facebook">
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-24 opacity-30 font-black uppercase tracking-tighter text-sm italic">No hay retos disponibles</div>
        )}
      </div>

      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/80 backdrop-blur-2xl border border-white/5 px-8 py-5 flex justify-around items-center z-50 rounded-[2.5rem] shadow-2xl">
        <Link to="/dashboard" className="text-slate-500 flex flex-col items-center gap-1"><span className="text-xl">🏠</span><span className="text-[8px] font-black uppercase tracking-widest">Inicio</span></Link>
        <Link to="/apuestas" className="text-green-500 flex flex-col items-center gap-1"><span className="text-xl">🔥</span><span className="text-[8px] font-black uppercase tracking-widest">Apuestas</span><div className="w-1 h-1 bg-green-500 rounded-full"></div></Link>
        <Link to="/notificaciones" className="text-slate-500 flex flex-col items-center gap-1"><span className="text-xl">🔔</span><span className="text-[8px] font-black uppercase tracking-widest">Notis</span></Link>
        {user?.rol === 'superadmin' && (
          <Link to="/admin" className="text-red-500 flex flex-col items-center gap-1">
            <span className="text-xl">⚙️</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Admin</span>
          </Link>
        )}
        <Link to="/perfil" className="text-slate-500 flex flex-col items-center gap-1"><span className="text-xl">👤</span><span className="text-[8px] font-black uppercase tracking-widest">Perfil</span></Link>
      </nav>
    </div>
  );
};

export default BetsWall;