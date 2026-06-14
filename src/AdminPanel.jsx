import { useState, useEffect } from "react";
import { db, functions } from "./config";
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, addDoc, Timestamp, orderBy, increment, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "./hooks/useAuthHook";
import { Link } from "react-router-dom";
import Toast from "./Toast";

const AdminPanel = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [scores, setScores] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [userFilter, setUserFilter] = useState("all"); // all, balance, admins
  const [newBalance, setNewBalance] = useState("");
  const [activeTab, setActiveTab] = useState("liquidar"); // liquidar, usuarios o crear
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [profitPercentage, setProfitPercentage] = useState(100);
  const [newMatch, setNewMatch] = useState({ homeTeam: "", awayTeam: "", date: "", time: "" });
  const [allUsers, setAllUsers] = useState([]);
  const [userBets, setUserBets] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [historyUser, setHistoryUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmUpdate, setConfirmUpdate] = useState(null);

  useEffect(() => {
    // Buscamos partidos pendientes (no cerrados)
    const q = query(collection(db, "matches"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => {
      // Filtramos en el cliente los que ya tienen más de 2.5 horas desde su inicio
      const now = new Date();
      const pastMatches = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(m => (now - m.dateTime.toDate()) / (1000 * 60) > 150);
      setMatches(pastMatches);
    });

    // Escuchar configuración global
    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (snap) => {
      if (snap.exists()) setProfitPercentage(snap.data().profitPercentage || 100);
    });

    // Listener para todos los usuarios (Lista completa)
    const unsubAll = onSnapshot(query(collection(db, "users"), orderBy("displayName", "asc")), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsub(); unsubSettings(); unsubAll(); };
  }, []);

  const handleInputChange = (matchId, field, val) => {
    setScores(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: val }
    }));
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const finalizarYLiquidar = async (match) => {
    const res = scores[match.id];
    
    if (!user) {
      return showToast("Sesión perdida. Por favor recarga la página.", "error");
    }

    console.log("Llamando a liquidateMatch con UID:", user.uid);
    
    if (!res || res.home === undefined || res.away === undefined) {
      return showToast("Debe ingresar el marcador final.", "error");
    }

    setIsProcessing(true);
    try {
      const liquidate = httpsCallable(functions, 'liquidateMatch', { timeout: 60000 });
      const result = await liquidate({
        matchId: match.id,
        homeGoals: parseInt(res.home),
        awayGoals: parseInt(res.away),
        penaltyHome: res.penaltyHome ? parseInt(res.penaltyHome) : 0,
        penaltyAway: res.penaltyAway ? parseInt(res.penaltyAway) : 0
      });

      showToast(`¡Éxito! Se procesaron ${result.data.processed} apuestas.`);
    } catch (error) {
      console.error("Error en liquidación:", error);
      showToast(`Error (${error.code}): ${error.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    try {
      const combinedDateTime = new Date(`${newMatch.date}T${newMatch.time}`);
      await addDoc(collection(db, "matches"), {
        homeTeam: newMatch.homeTeam,
        awayTeam: newMatch.awayTeam,
        dateTime: Timestamp.fromDate(combinedDateTime),
        status: 'pending',
        result: { homeGoals: 0, awayGoals: 0 }
      });
      showToast("¡Partido programado exitosamente!");
      setNewMatch({ homeTeam: "", awayTeam: "", date: "", time: "" });
    } catch (error) {
      showToast("Error al crear el partido: " + error.message, "error");
    }
  };

  const updateProfitSettings = async () => {
    try {
      await setDoc(doc(db, "settings", "global"), { profitPercentage: Number(profitPercentage) }, { merge: true });
      showToast("Porcentaje de ganancias actualizado.");
    } catch {
      showToast("Error al actualizar configuración.", "error");
    }
  };

  // Función para obtener apuestas de un usuario específico (Creadas o Aceptadas)
  const fetchUserBets = async (uid) => {
    setLoadingDetails(true);
    setUserBets([]);
    try {
      const q1 = query(collection(db, "bets"), where("creatorId", "==", uid));
      const q2 = query(collection(db, "bets"), where("acceptedByIds", "array-contains", uid));
      const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const combined = [...s1.docs.map(d => ({ id: d.id, ...d.data() })), ...s2.docs.map(d => ({ id: d.id, ...d.data() }))];
      // Eliminar duplicados por ID y guardar
      setUserBets(combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i));
    } catch {
      showToast("Error al cargar historial.", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Lógica de filtrado local para búsqueda y filtros de categoría
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = 
      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      userFilter === "all" || 
      (userFilter === "balance" && u.saldo > 0) || 
      (userFilter === "admins" && u.rol === "superadmin");

    return matchesSearch && matchesFilter;
  });

  const updateBalance = async () => {
    if (!confirmUpdate) return;
    try {
      const userRef = doc(db, "users", confirmUpdate.userId);
      
      const updateData = confirmUpdate.type === 'set' 
        ? { saldo: Number(confirmUpdate.amount) }
        : { saldo: increment(Number(confirmUpdate.amount)) };

      await updateDoc(userRef, updateData);
      showToast("Saldo actualizado correctamente.");
      setConfirmUpdate(null);
    } catch (error) {
      console.error(error);
      showToast("Error al actualizar saldo.", "error");
    }
  };

  if (user?.rol !== 'superadmin') return <div className="text-white p-10 font-bold">ACCESO RESTRINGIDO</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="bg-slate-800 p-2 rounded-xl text-xs font-bold">VOLVER</Link>
          <h1 className="text-2xl font-black italic leading-none uppercase">PANEL <span className="text-red-500">ADMIN</span></h1>
        </div>
        <img src="/logo.png" alt="" className="w-12 h-12 object-contain" />
      </div>

      {/* Configuración de Ganancias */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Configuración de Retorno</p>
          <p className="text-[10px] text-slate-600 italic">Define qué % de la apuesta del perdedor recibe el ganador.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <input 
              type="number" 
              value={profitPercentage} 
              onChange={(e) => setProfitPercentage(e.target.value)}
              className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-green-500 outline-none"
            />
            <span className="absolute right-3 top-2 text-slate-600 text-xs font-bold">%</span>
          </div>
          <button onClick={updateProfitSettings} className="bg-green-500 text-slate-950 px-6 py-2 rounded-xl font-black text-[10px] uppercase hover:opacity-90 transition-opacity">Guardar</button>
        </div>
      </div>

      {/* Tabs de Admin */}
      <div className="flex gap-2 mb-8">
        <button onClick={() => setActiveTab("liquidar")} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest ${activeTab === 'liquidar' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-500'}`}>Liquidar</button>
        <button onClick={() => setActiveTab("crear")} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest ${activeTab === 'crear' ? 'bg-green-600 text-white' : 'bg-slate-900 text-slate-500'}`}>Nuevo Partido</button>
        <button onClick={() => setActiveTab("usuarios")} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest ${activeTab === 'usuarios' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500'}`}>Gestión Usuarios</button>
      </div>

      {activeTab === "liquidar" && (
        <div className="space-y-4">
          {matches.length === 0 && <p className="text-slate-500 text-center py-20">No hay partidos por cerrar.</p>}
          {matches.map(m => (
            <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <p className="text-center text-[10px] font-black text-yellow-500 uppercase mb-4 tracking-tighter">Esperando Resultados Finales</p>
              <div className="flex justify-between items-center mb-6">
                <div className="flex-1 text-center"><p className="text-[10px] text-slate-500 font-bold mb-1 uppercase">{m.homeTeam}</p><input type="number" onChange={(e) => handleInputChange(m.id, 'home', e.target.value)} placeholder="0" className="w-16 bg-slate-800 rounded-xl p-3 text-center text-xl font-black outline-none" /></div>
                <div className="px-4 text-xl font-black text-slate-700 italic">VS</div>
                <div className="flex-1 text-center"><p className="text-[10px] text-slate-500 font-bold mb-1 uppercase">{m.awayTeam}</p><input type="number" onChange={(e) => handleInputChange(m.id, 'away', e.target.value)} placeholder="0" className="w-16 bg-slate-800 rounded-xl p-3 text-center text-xl font-black outline-none" /></div>
              </div>
              
              {/* Sección de Penales Dinámica */}
              {scores[m.id]?.home === scores[m.id]?.away && scores[m.id]?.home !== undefined && (
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-dashed border-slate-800 mb-6 animate-in slide-in-from-top-2 duration-300">
                  <p className="text-[9px] font-black text-slate-500 text-center uppercase mb-3 italic">Definición por Penales</p>
                  <div className="flex justify-center items-center gap-4">
                    <input type="number" onChange={(e) => handleInputChange(m.id, 'penaltyHome', e.target.value)} placeholder="P" className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-2 text-center text-sm font-bold text-yellow-500" />
                    <span className="text-slate-700">-</span>
                    <input type="number" onChange={(e) => handleInputChange(m.id, 'penaltyAway', e.target.value)} placeholder="P" className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-2 text-center text-sm font-bold text-yellow-500" />
                  </div>
                </div>
              )}

              <button 
                disabled={isProcessing}
                onClick={() => finalizarYLiquidar(m)} 
                className="w-full bg-red-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl uppercase text-xs"
              >
                {isProcessing ? "PROCESANDO..." : "Liquidar Apuestas"}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "crear" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg mx-auto animate-in fade-in zoom-in duration-200">
          <h2 className="text-xl font-black italic mb-6 text-center uppercase">Programar <span className="text-green-500">Nuevo Encuentro</span></h2>
          <form onSubmit={handleCreateMatch} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block px-1">Equipo A</label>
              <input type="text" required value={newMatch.homeTeam} onChange={e => setNewMatch({...newMatch, homeTeam: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-500" placeholder="Ej: Argentina" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block px-1">Equipo B</label>
              <input type="text" required value={newMatch.awayTeam} onChange={e => setNewMatch({...newMatch, awayTeam: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-500" placeholder="Ej: Francia" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block px-1 italic">Fecha (Calendario)</label>
                <input 
                  type="date" 
                  required 
                  value={newMatch.date} 
                  onChange={e => setNewMatch({...newMatch, date: e.target.value})} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none text-white focus:ring-2 focus:ring-green-500 transition-all" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block px-1 italic">Hora (Reloj)</label>
                <input 
                  type="time" 
                  required 
                  value={newMatch.time} 
                  onChange={e => setNewMatch({...newMatch, time: e.target.value})} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none text-white focus:ring-2 focus:ring-green-500 transition-all" 
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-green-500 text-slate-950 font-black py-4 rounded-2xl uppercase text-xs mt-4 shadow-lg shadow-green-500/20 active:scale-95 transition-all">Publicar Partido</button>
          </form>
        </div>
      )}

      {activeTab === "usuarios" && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-3.5 text-slate-500 text-lg">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por nombre o correo..." 
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Filtros de Categoría */}
          <div className="flex gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
            {['all', 'balance', 'admins'].map(f => (
              <button 
                key={f} 
                onClick={() => setUserFilter(f)}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${userFilter === f ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {f === 'all' ? 'Todos' : f === 'balance' ? 'Con Saldo' : 'Administradores'}
              </button>
            ))}
          </div>

          <div className="grid gap-4">
            {filteredUsers.map(u => (
              <div key={u.id} className="bg-slate-900 p-5 rounded-4xl border border-slate-800 shadow-xl animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <img src={u.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-slate-800 p-0.5" />
                    <div>
                      <p className="font-black text-sm text-white italic uppercase leading-none mb-1">{u.displayName}</p>
                      <p className="text-[10px] text-slate-500 font-bold truncate max-w-37.5">{u.email}</p>
                      <span className="inline-block bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[7px] font-black text-yellow-500 uppercase tracking-widest">{u.rol}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo Actual</p>
                    <p className="text-2xl font-black text-green-500 tracking-tighter italic leading-none">{u.saldo} <span className="text-[10px]">Bs.</span></p>
                  </div>
                </div>

                {/* RESALTADO DE ESTADÍSTICAS */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-green-500/10 border border-green-500/20 p-2.5 rounded-2xl text-center">
                    <p className="text-[7px] font-black text-green-500 uppercase tracking-tighter opacity-70 mb-0.5">💰 Ganado</p>
                    <p className="text-sm font-black text-green-400 tracking-tighter leading-none">{u.dineroGanado || 0} Bs.</p>
                    <div className="text-[7px] font-black text-slate-500 mt-1 uppercase tracking-widest">{u.estadisticas?.apuestasGanadas || 0} Wins</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-2xl text-center">
                    <p className="text-[7px] font-black text-red-500 uppercase tracking-tighter opacity-70 mb-0.5">💸 Perdido</p>
                    <p className="text-sm font-black text-red-400 tracking-tighter leading-none">{u.dineroPerdido || 0} Bs.</p>
                    <div className="text-[7px] font-black text-slate-500 mt-1 uppercase tracking-widest">{u.estadisticas?.apuestasPerididas || 0} Loss</div>
                  </div>
                </div>

                <div className="flex gap-2 items-center bg-slate-950 p-4 rounded-2xl border border-white/5">
                  <div className="flex-1">
                    <input 
                      type="number" 
                      placeholder="Monto..." 
                      className="w-full bg-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-blue-500"
                      onChange={(e) => setNewBalance(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if (!newBalance) return showToast("Ingresa un monto", "error");
                      setConfirmUpdate({ userId: u.id, userName: u.displayName, amount: newBalance, type: 'set' });
                    }} 
                    className="bg-slate-100 text-slate-950 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase active:scale-95 transition-all"
                  >
                    Fijar
                  </button>
                  <button 
                    onClick={() => {
                      if (!newBalance) return showToast("Ingresa un monto", "error");
                      setConfirmUpdate({ userId: u.id, userName: u.displayName, amount: newBalance, type: 'add' });
                    }} 
                    className="bg-green-500 text-slate-950 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase active:scale-95 transition-all shadow-lg shadow-green-500/10"
                  >
                    Sumar
                  </button>
                </div>

                {/* BOTONES DE AUDITORÍA */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button 
                    onClick={() => {
                      if(expandedUserId === u.id) setExpandedUserId(null);
                      else { setExpandedUserId(u.id); fetchUserBets(u.id); }
                    }}
                    className={`py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${expandedUserId === u.id ? 'bg-slate-700 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                  >
                    {expandedUserId === u.id ? 'Ocultar Acciones' : 'Ver Acciones'}
                  </button>
                  <button 
                    onClick={() => { setHistoryUser(u); fetchUserBets(u.id); }}
                    className="bg-blue-600/10 text-blue-400 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest border border-blue-500/20 active:scale-95 transition-all"
                  >
                    Ver Historial
                  </button>
                </div>

                {/* DESPLEGABLE DE ACCIONES */}
                {expandedUserId === u.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-in slide-in-from-top-4 duration-300">
                    {loadingDetails ? (
                      <div className="text-center py-6"><span className="animate-pulse text-[9px] font-black text-slate-600 tracking-widest uppercase italic">Cargando...</span></div>
                    ) : (
                      <>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase mb-2 tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span> Debo Cumplir
                          </p>
                          <div className="space-y-1.5">
                            {userBets.filter(b => b.betType === 'action' && b.status === 'finished' && ((b.result === 'rival_won' && b.creatorId === u.id) || (b.result === 'creator_won' && b.acceptedByIds?.includes(u.id)))).map(b => (
                              <div key={b.id} className="bg-slate-950 p-2.5 rounded-xl border border-white/5 flex justify-between items-center gap-2">
                                <p className="text-[9px] font-medium text-slate-300 italic truncate flex-1">"{b.valueAction}"</p>
                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded tracking-tighter ${b.actionStatus === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                  {b.actionStatus === 'completed' ? 'HECHO' : 'PEND'}
                                </span>
                              </div>
                            ))}
                            {userBets.filter(b => b.betType === 'action' && b.status === 'finished' && ((b.result === 'rival_won' && b.creatorId === u.id) || (b.result === 'creator_won' && b.acceptedByIds?.includes(u.id)))).length === 0 && (
                              <p className="text-[8px] text-slate-700 italic px-2">Sin penitencias pendientes.</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase mb-2 tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Me Deben
                          </p>
                          <div className="space-y-1.5">
                            {userBets.filter(b => b.betType === 'action' && b.status === 'finished' && ((b.result === 'creator_won' && b.creatorId === u.id) || (b.result === 'rival_won' && b.acceptedByIds?.includes(u.id)))).map(b => (
                              <div key={b.id} className="bg-slate-950 p-2.5 rounded-xl border border-white/5 flex justify-between items-center gap-2">
                                <p className="text-[9px] font-medium text-slate-300 italic truncate flex-1">"{b.valueAction}"</p>
                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded tracking-tighter ${b.actionStatus === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                  {b.actionStatus === 'completed' ? 'HECHO' : 'PEND'}
                                </span>
                              </div>
                            ))}
                            {userBets.filter(b => b.betType === 'action' && b.status === 'finished' && ((b.result === 'creator_won' && b.creatorId === u.id) || (b.result === 'rival_won' && b.acceptedByIds?.includes(u.id)))).length === 0 && (
                              <p className="text-[8px] text-slate-700 italic px-2">Nadie le debe nada aún.</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-center py-20 text-slate-500 font-bold italic">No se encontraron usuarios.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Saldo */}
      {confirmUpdate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-200 p-4 text-center">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-black italic uppercase text-white mb-4">CONFIRMAR <span className="text-yellow-500">OPERACIÓN</span></h2>
            <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 mb-6">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 px-1">Usuario: {confirmUpdate.userName}</p>
              <p className="text-xs text-slate-300 mb-4 font-medium italic">¿Estás seguro de establecer el nuevo saldo en:</p>
              <p className="text-3xl font-black text-green-500 tracking-tighter italic">
                {confirmUpdate.type === 'set' ? confirmUpdate.amount : `+${confirmUpdate.amount}`} Bs.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={updateBalance}
                className="w-full bg-green-500 text-slate-950 font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest shadow-lg shadow-green-500/10"
              >
                SÍ, ACTUALIZAR SALDO
              </button>
              <button 
                onClick={() => setConfirmUpdate(null)}
                className="w-full text-slate-500 font-bold py-2 text-[10px] uppercase tracking-widest hover:text-white transition-colors"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial Completo */}
      {historyUser && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-250 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black italic uppercase text-white leading-none">HISTORIAL <span className="text-blue-500">APUESTAS</span></h2>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 italic">{historyUser.displayName}</p>
              </div>
              <button onClick={() => setHistoryUser(null)} className="bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-50">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Compilando datos...</p>
                </div>
              ) : (
                <>
                  {userBets.filter(b => b.betType === 'money').map(b => {
                    const isWinner = (b.result === 'creator_won' && b.creatorId === historyUser.id) || (b.result === 'rival_won' && b.acceptedByIds?.includes(historyUser.id));
                    return (
                      <div key={b.id} className={`p-4 rounded-3xl border ${isWinner ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'} flex justify-between items-center`}>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-white uppercase tracking-tighter mb-1">ID: {b.id.slice(0, 8)}...</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase italic">Predicción: {b.prediction}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-black italic leading-none mb-1 ${isWinner ? 'text-green-500' : 'text-red-500'}`}>{isWinner ? 'W' : 'L'} · {b.valueMoney} Bs.</p>
                          <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">{b.status}</p>
                        </div>
                      </div>
                    );
                  })}
                  {userBets.filter(b => b.betType === 'money').length === 0 && <p className="text-center py-10 text-slate-600 text-[10px] font-bold uppercase italic">Sin historial monetario aún.</p>}
                </>
              )}
            </div>
            <button onClick={() => setHistoryUser(null)} className="w-full bg-slate-100 text-slate-950 font-black py-4 rounded-2xl mt-6 uppercase text-[10px] tracking-widest active:scale-95 transition-all">Cerrar Historial</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;