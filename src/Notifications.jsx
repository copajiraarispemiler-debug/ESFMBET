import { useState, useEffect } from "react";
import { db } from "./config";
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "./hooks/useAuthHook";
import { Link } from "react-router-dom";

const Notifications = () => {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, "notifications"), {
        text,
        timestamp: Timestamp.now(),
        author: user.displayName
      });
      setText("");
    } catch (err) { alert("Error al publicar", err); }
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Borrar noticia?")) await deleteDoc(doc(db, "notifications", id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-28">
      <header className="flex flex-col items-center mb-10 pt-4">
        <img src="/logo.png" alt="" className="w-20 h-20 mb-4 object-contain" />
        <h1 className="text-3xl font-black italic uppercase tracking-tighter">Comunicados <span className="text-blue-500">ESFM</span></h1>
      </header>

      {/* Solo Admin puede escribir */}
      {user?.rol === 'superadmin' && (
        <form onSubmit={handlePost} className="bg-slate-900 p-6 rounded-[2.5rem] border border-blue-500/20 mb-8 shadow-2xl shadow-blue-500/5">
          <p className="text-[10px] font-black text-blue-500 uppercase mb-3 tracking-widest italic">Nueva Notificación General</p>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe el anuncio para la comunidad..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-25"
          />
          <button type="submit" className="w-full bg-blue-600 font-black py-4 rounded-2xl mt-4 text-[10px] uppercase tracking-widest active:scale-95 transition-all">Publicar Comunicado</button>
        </form>
      )}

      <div className="space-y-4">
        {notifs.map((n) => (
          <div key={n.id} className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] relative group">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{n.timestamp?.toDate().toLocaleString()}</span>
              {user?.rol === 'superadmin' && (
                <button onClick={() => handleDelete(n.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              )}
            </div>
            <p className="text-sm font-medium text-slate-200 leading-relaxed italic">"{n.text}"</p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter italic">ADMIN: {n.author}</span>
            </div>
          </div>
        ))}
        {notifs.length === 0 && <p className="text-center py-20 text-slate-600 font-bold italic uppercase text-xs">No hay avisos recientes.</p>}
      </div>

      {/* Barra de Navegación (Igual que en BetsWall) */}
      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/80 backdrop-blur-2xl border border-white/5 px-8 py-5 flex justify-around items-center z-50 rounded-[2.5rem] shadow-2xl">
        <Link to="/dashboard" className="text-slate-500 flex flex-col items-center gap-1"><span className="text-xl">🏠</span><span className="text-[8px] font-black uppercase tracking-widest">Inicio</span></Link>
        <Link to="/apuestas" className="text-slate-500 flex flex-col items-center gap-1"><span className="text-xl">🔥</span><span className="text-[8px] font-black uppercase tracking-widest">Apuestas</span></Link>
        <Link to="/notificaciones" className="text-blue-500 flex flex-col items-center gap-1">
          <span className="text-xl">🔔</span>
          <span className="text-[8px] font-black uppercase tracking-widest">Notis</span>
          <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
        </Link>
        {user?.rol === 'superadmin' && (
          <Link to="/admin" className="text-red-500 flex flex-col items-center gap-1"><span className="text-xl">⚙️</span><span className="text-[8px] font-black uppercase tracking-widest">Admin</span></Link>
        )}
        <Link to="/perfil" className="text-slate-500 flex flex-col items-center gap-1"><span className="text-xl">👤</span><span className="text-[8px] font-black uppercase tracking-widest">Perfil</span></Link>
      </nav>
    </div>
  );
};

export default Notifications;