import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "./config";
import { doc, getDoc, runTransaction, arrayUnion } from "firebase/firestore";
import { useAuth } from "./hooks/useAuthHook";
import confetti from 'canvas-confetti';
import Loading from "./Loading";

const ChallengeView = () => {
  const { betId } = useParams();
  const { user, loginWithGoogle } = useAuth();
  const [bet, setBet] = useState(null);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBet = async () => {
      try {
        const betSnap = await getDoc(doc(db, "bets", betId));
        if (betSnap.exists()) {
          const betData = betSnap.data();
          setBet({ id: betSnap.id, ...betData });
          const matchSnap = await getDoc(doc(db, "matches", betData.matchId));
          setMatch(matchSnap.data());
        }
      } catch (error) {
        console.error("Error fetching challenge:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBet();
  }, [betId]);

  const handleAccept = async () => {
    if (!user) return loginWithGoogle();
    if (bet.creatorId === user.uid) return alert("No puedes aceptar tu propio reto.");

    try {
      await runTransaction(db, async (transaction) => {
        const betRef = doc(db, "bets", bet.id);
        const userRef = doc(db, "users", user.uid);
        
        const betSnap = await transaction.get(betRef);
        const userData = (await transaction.get(userRef)).data();

        if (!betSnap.exists()) throw "El reto ya no existe.";
        if (betSnap.data().status !== 'open') throw "Este reto ya ha sido aceptado.";

        if (bet.betType === 'money') {
          if (userData.saldo < bet.valueMoney) throw `Saldo insuficiente. Necesitas ${bet.valueMoney} Bs.`;
          transaction.update(userRef, { saldo: userData.saldo - bet.valueMoney });
        }

        transaction.update(betRef, {
          status: 'active',
          acceptedByIds: arrayUnion(user.uid)
        });
      });

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#ffffff', '#eab308']
      });

      alert("¡Reto aceptado con éxito!");
      navigate("/dashboard");
    } catch (error) {
      alert(error);
    }
  };

  if (loading) return <Loading />;
  if (!bet) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-bold uppercase tracking-tighter">Reto no encontrado o expirado.</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[3rem] p-10 shadow-2xl text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-500/10 blur-[100px] rounded-full"></div>
        
        <h1 className="text-3xl font-black italic text-white mb-2 uppercase tracking-tighter leading-none">
          HAS SIDO <br /> <span className="text-green-500">RETADO</span>
        </h1>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Por {bet.creatorName}</p>

        <div className="bg-slate-950/50 rounded-4xl p-6 mb-8 border border-slate-800/50">
          <div className="flex justify-between items-center mb-4 px-2">
            <span className="text-[10px] font-black text-slate-500 uppercase">{match?.homeTeam}</span>
            <span className="text-xs font-black text-slate-700 italic">VS</span>
            <span className="text-[10px] font-black text-slate-500 uppercase">{match?.awayTeam}</span>
          </div>
          
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Predicción del retador:</p>
          <p className="text-lg font-black text-green-400 uppercase italic tracking-tighter mb-4">
            {bet.prediction.startsWith('exact_') ? `Marcador: ${bet.prediction.split('_')[1]}` : 
             bet.prediction === 'home' ? `Gana ${match?.homeTeam}` : 
             bet.prediction === 'away' ? `Gana ${match?.awayTeam}` : 'Empate'}
          </p>

          <div className="pt-4 border-t border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Valor del reto:</p>
            <p className={`text-2xl font-black italic ${bet.betType === 'money' ? 'text-white' : 'text-purple-400 uppercase'}`}>
              {bet.betType === 'money' ? `${bet.valueMoney} Bs.` : bet.valueAction}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={handleAccept}
            className="w-full bg-white text-slate-950 font-black py-5 rounded-3xl active:scale-95 transition-all text-xs uppercase tracking-widest shadow-xl shadow-white/5"
          >
            {user ? 'ACEPTAR EL RETO' : 'ENTRAR PARA ACEPTAR'}
          </button>
          <button onClick={() => navigate("/")} className="w-full text-slate-500 font-bold text-[10px] uppercase tracking-widest py-2">Ignorar reto</button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeView;