import { useState, useEffect } from "react";
import { db } from "./config";
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import { useAuth } from "./hooks/useAuthHook";
import { Link } from "react-router-dom";
import CreateBetModal from "./CreateBetModal";

const Dashboard = () => {
  const { user } = useAuth();
  const [topUsers, setTopUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [closedMatches, setClosedMatches] = useState([]);
  const [userBets, setUserBets] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [notification, setNotification] = useState(null);
  const [viewTab, setViewTab] = useState("pendientes"); // pendientes o jugados
  const [activeBets, setActiveBets] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Actualiza cada minuto

    const topQuery = query(collection(db, "users"), orderBy("balones", "desc"), limit(5));
    const unsubTop = onSnapshot(topQuery, (snap) => {
      setTopUsers(snap.docs.map(doc => doc.data()));
    });

    const matchesQuery = query(
      collection(db, "matches"), 
      where("status", "==", "pending"), 
      orderBy("dateTime", "asc"),
      limit(5)
    );

    const unsubMatches = onSnapshot(matchesQuery, (snap) => {
      setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const closedQuery = query(collection(db, "matches"), where("status", "==", "closed"), orderBy("dateTime", "desc"), limit(10));
    const unsubClosed = onSnapshot(closedQuery, (snap) => {
      setClosedMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Cargar apuestas activas para mostrar duelistas en cards
    const activeBetsQuery = query(collection(db, "bets"), where("status", "==", "active"));
    const unsubActiveBets = onSnapshot(activeBetsQuery, (snap) => {
      setActiveBets(snap.docs.map(doc => doc.data()));
    });

    let unsubBets;
    if (user) {
      const betsQuery = query(collection(db, "bets"), where("creatorId", "==", user.uid));
      unsubBets = onSnapshot(betsQuery, (snap) => {
        setUserBets(snap.docs.map(doc => doc.data()));
      });
    }

    return () => {
      unsubTop();
      unsubMatches();
      unsubClosed();
      unsubActiveBets();
      if (unsubBets) unsubBets();
      clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "bets"),
      where("creatorId", "==", user.uid),
      where("status", "==", "active")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          setNotification("⚽ ¡Uno de tus retos ha sido aceptado! El juego está en marcha.");
          setTimeout(() => setNotification(null), 5000);
        }
      });
    });
    return () => unsubscribe();
  }, [user]);

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const getMatchTimeStatus = (matchDate) => {
    if (!matchDate || !matchDate.toDate) return { label: "PENDIENTE", color: "bg-slate-800 text-slate-400", canBet: true };
    const diff = (currentTime - matchDate.toDate()) / (1000 * 60); // Diferencia en minutos
    if (diff < 0) return { label: "PENDIENTE", color: "bg-slate-800 text-slate-400", canBet: true };
    if (diff >= 0 && diff <= 150) return { label: "VIVO", color: "bg-red-500 text-white animate-pulse", canBet: false };
    return { label: "ESPERA DE RESULTADOS", color: "bg-yellow-500 text-slate-950", canBet: false };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-20">
      {/* Header con Logo y Términos */}
      <div className="flex justify-between items-center mb-6 px-2">
        <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20 rotate-3">
          <span className="text-2xl">⚽</span>
        </div>
        <Link to="/terminos" className="text-[9px] font-black text-slate-500 border border-slate-800 px-4 py-2 rounded-full uppercase tracking-widest hover:text-white transition-colors">
          Términos y Condiciones
        </Link>
      </div>

      {notification && (
        <div className="fixed top-4 left-4 right-4 z-200 animate-in slide-in-from-top duration-300">
          <div className="bg-green-500 text-slate-950 px-6 py-4 rounded-2xl font-black text-xs shadow-2xl flex items-center justify-between border-b-4 border-green-700">
            <span>{notification}</span>
            <button onClick={() => setNotification(null)}>✕</button>
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-3xl p-6 mb-6 border border-slate-800 shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="text-yellow-500">🏆</span> Ranking Global
        </h2>
        <div className="space-y-3">
          {topUsers.map((u, i) => (
            <div key={u.uid} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="font-black text-slate-500 w-4">{i + 1}</span>
                <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
                <span className="font-medium truncate max-w-30">{u.displayName}</span>
              </div>
              <div className="flex items-center gap-1 text-green-400 font-bold">
                {u.balones} <span className="text-[10px]">⚽</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-800">
        <button onClick={() => setViewTab("pendientes")} className={`pb-2 text-xs font-black uppercase tracking-widest transition-all ${viewTab === "pendientes" ? "text-green-500 border-b-2 border-green-500" : "text-slate-500"}`}>Próximos</button>
        <button onClick={() => setViewTab("jugados")} className={`pb-2 text-xs font-black uppercase tracking-widest transition-all ${viewTab === "jugados" ? "text-green-500 border-b-2 border-green-500" : "text-slate-500"}`}>Resultados</button>
      </div>

      <div className="grid gap-4">
        {viewTab === "pendientes" ? (
          matches.length > 0 ? matches.map((match) => {
            const dateObj = match.dateTime?.toDate();
            const timeStatus = getMatchTimeStatus(match.dateTime);
            const duel = activeBets.find(b => b.matchId === match.id);
            
            return (
              <div key={match.id} className={`bg-slate-900 border ${match.status === 'live' ? 'border-red-500' : 'border-slate-800'} rounded-3xl p-5 flex flex-col items-center relative overflow-hidden animate-in fade-in duration-500`}>
                <div className="flex justify-between items-center w-full mb-1">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${timeStatus.color}`}>
                    {timeStatus.label}
                  </span>
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">
                    {isToday(dateObj) ? 'Hoy' : dateObj?.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
                
                <div className="flex justify-between items-center w-full mb-4 mt-2">
                  <div className="flex-1 text-center font-black text-sm uppercase italic">{match.homeTeam}</div>
                  <div className="bg-slate-950 px-3 py-1.5 rounded-xl text-xs font-black text-white border border-slate-800 mx-4">
                    {dateObj?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-1 text-center font-black text-sm uppercase italic">{match.awayTeam}</div>
                </div>

                {duel && (
                  <div className="w-full bg-blue-600/10 border border-blue-500/20 rounded-2xl p-3 mb-4 text-center">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Duelo Confirmado</p>
                    <p className="text-[10px] font-bold text-white uppercase tracking-tighter">
                      {duel.creatorName} <span className="text-red-500 italic mx-1">vs</span> {duel.acceptedByNames?.[0] || 'Rival'}
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium mt-1">
                      {duel.betType === 'money' ? `💰 ${duel.valueMoney} Bs.` : `🔥 ${duel.valueAction.slice(0, 20)}...`}
                    </p>
                  </div>
                )}

                <button 
                  disabled={!timeStatus.canBet}
                  onClick={() => setSelectedMatch(match)} 
                  className={`w-full ${timeStatus.canBet ? 'bg-green-500 text-slate-950' : 'bg-slate-800 text-slate-500'} font-black py-3 rounded-2xl active:scale-95 text-xs uppercase tracking-widest transition-colors`}
                >
                  {timeStatus.canBet ? "Apostar ahora" : "Apuestas Cerradas"}
                </button>
              </div>
            );
          }) : <p className="text-slate-500 text-center py-10">No hay partidos próximos.</p>
        ) : (
          closedMatches.length > 0 ? closedMatches.map((match) => {
            const matchBets = userBets.filter(b => b.matchId === match.id);
            return (
              <div key={match.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex-1 text-center text-xs font-bold text-slate-400">{match.homeTeam}</div>
                  <div className="px-4 py-1 bg-slate-800 rounded-xl font-black text-lg">
                    {match.result?.homeGoals} - {match.result?.awayGoals}
                  </div>
                  <div className="flex-1 text-center text-xs font-bold text-slate-400">{match.awayTeam}</div>
                </div>
                {matchBets.map((bet, idx) => (
                  <div key={idx} className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">Tu apuesta: {bet.prediction}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${bet.result === 'creator_won' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {bet.result === 'creator_won' ? '+ GANASTE' : '- PERDISTE'}
                    </span>
                  </div>
                ))}
              </div>
            );
          }) : <p className="text-slate-500 text-center py-10">Historial vacío.</p>
        )}
      </div>

      {selectedMatch && (
        <CreateBetModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 px-6 py-3 flex justify-around items-center z-50">
        <Link to="/dashboard" className="text-green-500 flex flex-col items-center gap-1">
          <span className="text-xl">🏠</span>
          <span className="text-[10px] font-bold">INICIO</span>
        </Link>
        <Link to="/apuestas" className="text-slate-400 flex flex-col items-center gap-1">
          <span className="text-xl">🔥</span>
          <span className="text-[10px] font-bold">MURO</span>
        </Link>
        {user?.rol === 'superadmin' && (
          <Link to="/admin" className="text-red-500 flex flex-col items-center gap-1">
            <span className="text-xl">⚙️</span>
            <span className="text-[10px] font-bold tracking-tighter">ADMIN</span>
          </Link>
        )}
        <Link to="/perfil" className="text-slate-400 flex flex-col items-center gap-1">
          <span className="text-xl">👤</span>
          <span className="text-[10px] font-bold">PERFIL</span>
        </Link>
      </nav>
    </div>
  );
};

export default Dashboard;