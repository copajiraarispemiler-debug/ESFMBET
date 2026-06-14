import { Link } from "react-router-dom";

const TermsView = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex items-center gap-4 mb-10">
        <Link to="/dashboard" className="text-slate-500 text-2xl">✕</Link>
        <h1 className="text-2xl font-black italic uppercase">Términos y <span className="text-green-500">Condiciones</span></h1>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 space-y-6 text-slate-400 text-xs leading-relaxed font-medium italic">
        <p>• ESFMBET es una plataforma social de predicciones deportivas.</p>
        <p>• Los usuarios son responsables de cumplir con las penitencias pactadas en la modalidad de "Acción".</p>
        <p>• La carga y retiro de saldo se gestiona manualmente vía WhatsApp con los administradores autorizados.</p>
        <p>• Cualquier intento de fraude resultará en la suspensión inmediata de la cuenta y el congelamiento de fondos.</p>
        <p>• Al utilizar esta aplicación, declaras ser mayor de edad en tu jurisdicción correspondiente.</p>
        
        <div className="pt-8 text-center text-[10px] text-slate-600 uppercase font-black">
          ESFM BET - Mundial 2026 © Todos los derechos reservados
        </div>
      </div>
    </div>
  );
};
export default TermsView;