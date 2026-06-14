import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuthHook";
import { db } from "./config";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import WithdrawModal from "./WithdrawModal";
import { Link } from "react-router-dom";

const Profile = () => {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("debo");
  const [actions, setActions] = useState([]);
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Escuchar apuestas de tipo 'action' donde el usuario esté involucrado
    const q = query(
      collection(db, "bets"),
      where("betType", "==", "action"),
      where("status", "==", "finished")
    );

    const unsub = onSnapshot(q, (snap) => {
      const allActions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filtrar localmente por roles
      setActions(allActions.filter(a => 
        a.creatorId === user.uid || a.acceptedByIds?.includes(user.uid)
      ));
    });

    return () => unsub();
  }, [user]);

  const handleCompleteAction = async (actionId) => {
    try {
      await updateDoc(doc(db, "bets", actionId), { actionStatus: 'completed' });
    } catch {
      alert("Error al actualizar la acción.");
    }
  };

  const handleRecharge = () => {
    const text = `Hola! Soy ${user.displayName}. Quiero cargar saldo a mi cuenta ESFM BET (ID: ${user.uid})`;
    window.open(`https://wa.me/59179398606?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (!user) return null;

  // Filtrar acciones por pestaña
  // "Debo" -> El usuario perdió y el creador ganó, o viceversa
  const actionsDebo = actions.filter(a => (a.result === 'rival_won' && a.creatorId === user.uid) || (a.result === 'creator_won' && a.acceptedByIds?.includes(user.uid)));
  const actionsMeDeben = actions.filter(a => (a.result === 'creator_won' && a.creatorId === user.uid) || (a.result === 'rival_won' && a.acceptedByIds?.includes(user.uid)));

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-24">
      {/* Botón de atrás */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard" className="bg-slate-800 p-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors">VOLVER</Link>
        <h1 className="text-xl font-black italic uppercase">MI <span className="text-green-500">PERFIL</span></h1>
      </div>

      {/* Header Perfil */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="relative mb-4">
          <img src={user.photoURL} alt="" className="w-24 h-24 rounded-full border-4 border-green-500 p-1 shadow-lg shadow-green-500/20" />
          <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-slate-950 text-[10px] font-black px-2 py-1 rounded-md">
            {user.rol?.toUpperCase()}
          </div>
        </div>
        <h1 className="text-2xl font-black">{user.displayName}</h1>
        <p className="text-slate-500 text-xs font-mono mb-6">ID: {user.uid}</p>

        {/* Cards de Saldo */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
            <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Saldo Actual</p>
            <p className="text-2xl font-black text-green-400">{user.saldo} Bs.</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
            <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Balones</p>
            <p className="text-2xl font-black text-yellow-500">{user.balones} ⚽</p>
          </div>
        </div>
      </div>

      {/* Acciones de Cuenta */}
      <div className="flex gap-3 mb-8">
        <button onClick={handleRecharge} className="flex-1 bg-green-500 text-slate-950 font-black py-3 rounded-2xl active:scale-95 transition-transform text-sm">
          CARGAR SALDO
        </button>
        <button 
          onClick={() => setShowWithdraw(true)}
          className="flex-1 bg-slate-100 text-slate-950 font-black py-3 rounded-2xl active:scale-95 transition-transform text-sm"
        >
          RETIRAR
        </button>
      </div>

      {/* Historial de Penitencias */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
        <div className="flex border-b border-slate-800">
          <button onClick={() => setTab("debo")} className={`flex-1 py-3 text-xs font-black transition-colors ${tab === "debo" ? "bg-slate-800 text-white" : "text-slate-500"}`}>
            DEBO CUMPLIR
          </button>
          <button onClick={() => setTab("me-deben")} className={`flex-1 py-3 text-xs font-black transition-colors ${tab === "me-deben" ? "bg-slate-800 text-white" : "text-slate-500"}`}>
            ME DEBEN
          </button>
        </div>
        
        <div className="p-4 min-h-50">
          {(tab === "debo" ? actionsDebo : actionsMeDeben).map(action => (
            <div key={action.id} className="bg-slate-800/40 p-4 rounded-2xl mb-3 border border-slate-700/50">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${action.actionStatus === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {action.actionStatus === 'completed' ? 'COMPLETADO' : 'PENDIENTE'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-300 mb-2 italic">"{action.valueAction}"</p>
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-bold">Ref: {action.id.slice(0, 8)}</span>
                {tab === "me-deben" && action.actionStatus !== 'completed' && (
                  <button 
                    onClick={() => handleCompleteAction(action.id)}
                    className="bg-green-500 text-slate-950 text-[9px] font-black px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                  >
                    MARCAR COMO CUMPLIDO
                  </button>
                )}
              </div>
            </div>
          ))}
          {(tab === "debo" ? actionsDebo : actionsMeDeben).length === 0 && (
            <div className="text-center text-slate-600 text-xs py-10">
              No hay registros en esta sección.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Retiro */}
      {showWithdraw && (
        <WithdrawModal user={user} onClose={() => setShowWithdraw(false)} />
      )}

      <button onClick={logout} className="w-full mt-8 text-red-500 font-bold text-sm py-4 border border-red-500/20 rounded-2xl">
        CERRAR SESIÓN
      </button>
    </div>
  );
};

export default Profile;