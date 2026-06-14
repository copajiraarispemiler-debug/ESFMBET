import { useState } from "react";

const WithdrawModal = ({ user, onClose }) => {
  const [bankData, setBankData] = useState("");
  
  const handleWithdraw = () => {
    const text = `🚀 SOLICITUD DE RETIRO - ESFM BET\n\n👤 Usuario: ${user.displayName}\n🆔 ID: ${user.uid}\n💰 Saldo a retirar: ${user.saldo} Bs.\n🏦 Datos/QR: ${bankData}`;
    window.open(`https://wa.me/59179398606?text=${encodeURIComponent(text)}`, "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-100 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
        <h2 className="text-xl font-black italic uppercase text-white mb-6">RETIRAR <span className="text-green-500">GANANCIAS</span></h2>
        
        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 mb-6">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Saldo disponible</p>
          <p className="text-2xl font-black text-green-400">{user.saldo} Bs.</p>
        </div>
        
        <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block tracking-widest px-1">Datos de transferencia o enlace de QR</label>
        <textarea 
          value={bankData}
          onChange={(e) => setBankData(e.target.value)}
          className="w-full bg-slate-800 rounded-2xl p-4 text-sm font-medium text-white h-32 outline-none focus:ring-2 focus:ring-green-500 mb-6 transition-all"
          placeholder="Escribe aquí tu Banco, Nro de Cuenta, Tipo de cuenta y CI, o pega un link a tu imagen de QR..."
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 text-slate-500 font-bold py-4 text-xs uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={handleWithdraw}
            disabled={!bankData || user.saldo <= 0}
            className="flex-2 bg-green-500 disabled:opacity-20 text-slate-950 font-black py-4 rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest shadow-lg shadow-green-500/10"
          >
            SOLICITAR POR WHATSAPP
          </button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawModal;