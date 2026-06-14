import { useState } from "react";
import { db } from "./config";
import { collection, doc, runTransaction, increment } from "firebase/firestore";
import { useAuth } from "./hooks/useAuthHook";

const CreateBetModal = ({ match, onClose }) => {
  const { user } = useAuth();
  const [modality, setModality] = useState("libre");
  const [betType, setBetType] = useState("money");
  const [prediction, setPrediction] = useState("home");
  const [exactHome, setExactHome] = useState(0);
  const [exactAway, setExactAway] = useState(0);
  const [valueMoney, setValueMoney] = useState(10);
  const [valueAction, setValueAction] = useState("");
  const [challengedPhone, setChallengedPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert("Debes iniciar sesión para apostar.");

    const finalPrediction = prediction === "exact" ? `exact_${exactHome}-${exactAway}` : prediction;
    
    setLoading(true);
    let createdBetId = "";
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw "Usuario no encontrado.";
        const userData = userSnap.data();

        if (betType === "money") {
          if (userData.saldo < valueMoney) {
            throw "Saldo insuficiente para realizar esta apuesta.";
          }
          // Regla 4: Congelar saldo del creador
          transaction.update(userRef, { saldo: increment(-Number(valueMoney)) });
        }

        const newBetRef = doc(collection(db, "bets"));
        createdBetId = newBetRef.id;
        transaction.set(newBetRef, {
          creatorId: user.uid,
          creatorName: user.displayName,
          matchId: match.id,
          modality,
          betType,
          prediction: finalPrediction,
          valueMoney: betType === "money" ? Number(valueMoney) : 0,
          valueAction: betType === "action" ? valueAction : "",
          challengedPhone: modality === "reto" ? challengedPhone : null,
          status: "open",
          createdAt: new Date(),
          acceptedByIds: []
        });
      });

      alert("¡Apuesta publicada exitosamente!");
      
      if (modality === "reto" && challengedPhone) {
        const text = `⚽ ¡Te reto en ESFM BET! ⚽\nPartido: ${match.homeTeam} vs ${match.awayTeam}\nEntra aquí para aceptar: ${window.location.origin}/challenge/${createdBetId}`;
        window.open(`https://wa.me/591${challengedPhone}?text=${encodeURIComponent(text)}`, "_blank");
      }

      onClose();
    } catch (error) {
      console.error(error);
      alert(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black italic uppercase text-white">NUEVA <span className="text-green-500">APUESTA</span></h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">✕</button>
        </div>

        <p className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-widest text-center">
          {match.homeTeam} <span className="text-slate-700 italic mx-2">VS</span> {match.awayTeam}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Modalidad */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Modalidad</label>
            <div className="grid grid-cols-2 gap-2">
              {['libre', 'reto', 'accion', 'mercado'].map(m => (
                <button type="button" key={m} onClick={() => setModality(m)} className={`py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${modality === m ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Reto Directo */}
          {modality === "reto" && (
            <div className="animate-in fade-in slide-in-from-left duration-300">
              <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest">WhatsApp del Rival (Sin +591)</label>
              <input 
                type="number" 
                value={challengedPhone} 
                onChange={e => setChallengedPhone(e.target.value)} 
                placeholder="79398606"
                className="w-full bg-slate-800 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          )}

          {/* Tipo de Apuesta */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Lo que arriesgas</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setBetType("money")} className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${betType === 'money' ? 'bg-green-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>💰 Dinero</button>
              <button type="button" onClick={() => setBetType("action")} className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${betType === 'action' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`}>🔥 Acción</button>
            </div>
          </div>

          {/* Predicción */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Tu Predicción</label>
            <select 
              value={prediction} 
              onChange={(e) => setPrediction(e.target.value)}
              className="w-full bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-white focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="home">Gana {match.homeTeam}</option>
              <option value="away">Gana {match.awayTeam}</option>
              <option value="draw">Empate</option>
              <option value="exact">Marcador Exacto</option>
            </select>
            {prediction === "exact" && (
              <div className="flex items-center gap-3 mt-3">
                <input type="number" value={exactHome} onChange={e => setExactHome(e.target.value)} className="w-full bg-slate-800 rounded-xl py-2 text-center font-bold" placeholder="Local" />
                <span className="text-slate-600 font-bold">-</span>
                <input type="number" value={exactAway} onChange={e => setExactAway(e.target.value)} className="w-full bg-slate-800 rounded-xl py-2 text-center font-bold" placeholder="Visita" />
              </div>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">{betType === 'money' ? 'Monto (Bs.)' : 'Descripción de la Acción'}</label>
            {betType === 'money' ? (
              <input type="number" value={valueMoney} onChange={e => setValueMoney(e.target.value)} className="w-full bg-slate-800 rounded-xl py-3 px-4 font-black text-green-400 text-xl" />
            ) : (
              <textarea value={valueAction} onChange={e => setValueAction(e.target.value)} className="w-full bg-slate-800 rounded-xl py-3 px-4 text-sm font-medium h-20 outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ej: Me rapo si pierdo..." />
            )}
          </div>

          <button 
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 text-slate-950 font-black py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 mt-4 uppercase tracking-widest text-xs"
          >
            {loading ? 'Publicando...' : 'PUBLICAR RETO'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateBetModal;