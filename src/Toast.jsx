import { useEffect } from "react";

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = type === "success";
  
  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-300 w-[90%] max-w-sm animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`
        ${isSuccess ? 'bg-green-500 border-green-600' : 'bg-red-600 border-red-700'} 
        text-slate-950 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 border-b-4
      `}>
        <div className="bg-slate-950/20 w-10 h-10 rounded-2xl flex items-center justify-center text-xl">
          {isSuccess ? '🏆' : '🚨'}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-70">ESFM BET INFO</p>
          <p className="text-xs font-black uppercase tracking-tighter leading-tight italic">{message}</p>
        </div>
        <button onClick={onClose} className="text-slate-950/40 hover:text-slate-950 text-xl font-bold px-2">✕</button>
      </div>
    </div>
  );
};

export default Toast;