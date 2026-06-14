import { Link } from "react-router-dom";

const RulesView = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-24">
      <header className="flex flex-col items-center mb-10 pt-4">
        <img src="/logo.png" alt="" className="w-16 h-16 mb-4 object-contain opacity-80" />
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-slate-500 text-xl">✕</Link>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">Reglamento <span className="text-green-500">Oficial</span></h1>
        </div>
      </header>

      <div className="space-y-8">
        {/* SECCIÓN 1: BALONES */}
        <section>
          <h2 className="text-blue-500 font-black text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <span className="w-8 h-px bg-blue-500/30"></span> 01. Sistema de Puntuación
          </h2>
          <div className="grid gap-3">
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl flex justify-between items-center">
              <div><p className="text-xs font-bold text-white uppercase italic">Victoria en Mercado</p><p className="text-[9px] text-slate-500">Retos abiertos aceptados por la comunidad.</p></div>
              <span className="text-green-500 font-black">+3 Balones</span>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl flex justify-between items-center">
              <div><p className="text-xs font-bold text-white uppercase italic">Victoria en Reto</p><p className="text-[9px] text-slate-500">Apuestas directas 1 a 1 aceptadas.</p></div>
              <span className="text-green-500 font-black">+2 Balones</span>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl flex justify-between items-center">
              <div><p className="text-xs font-bold text-white uppercase italic">Bono Marcador Exacto</p><p className="text-[9px] text-slate-500">Acierta los goles exactos del encuentro.</p></div>
              <span className="text-yellow-500 font-black">+1 Extra</span>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: SALDO */}
        <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6">
          <h2 className="text-green-500 font-black text-[10px] uppercase mb-4 italic">02. Gestión de Saldo (💰)</h2>
          <ul className="space-y-3 text-[10px] font-medium text-slate-400">
            <li className="flex gap-2">
              <span className="text-green-500">✔</span>
              <p>Al crear o aceptar un reto monetario, el <span className="text-white">saldo se congela automáticamente</span> hasta que el Admin liquide el partido.</p>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">✔</span>
              <p>Las recargas se gestionan vía WhatsApp con el comprobante de transferencia.</p>
            </li>
            <li className="flex gap-2">
              <span className="text-green-500">✔</span>
              <p>El ganador recibe su apuesta más el porcentaje de retorno configurado (Comisión de la casa aplicada).</p>
            </li>
          </ul>
        </section>

        {/* SECCIÓN 3: PENITENCIAS */}
        <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6">
          <h2 className="text-purple-500 font-black text-[10px] uppercase mb-4 italic">03. Apuestas de Acción (🔥)</h2>
          <ul className="space-y-3 text-[10px] font-medium text-slate-400">
            <li className="flex gap-2">
              <span className="text-purple-500">●</span>
              <p>Son retos físicos o penitencias definidas por los jugadores.</p>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-500">●</span>
              <p><span className="text-white">Validación:</span> El ganador es el único que puede marcar la acción como "CUMPLIDA" desde su perfil una vez el perdedor haya pagado.</p>
            </li>
          </ul>
        </section>

        {/* SECCIÓN 4: LIQUIDACIÓN */}
        <section className="bg-red-600/5 border border-red-500/20 rounded-[2.5rem] p-6">
          <h2 className="text-red-500 font-black text-[10px] uppercase mb-4 italic text-center">Aviso de Liquidación</h2>
          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            Los partidos se liquidan aproximadamente <span className="text-white">2.5 horas después</span> de su inicio. 
            Si un reto no fue aceptado por nadie antes de la liquidación, será <span className="text-white">eliminado automáticamente</span> del sistema.
          </p>
        </section>
      </div>

    </div>
  );
};

export default RulesView;