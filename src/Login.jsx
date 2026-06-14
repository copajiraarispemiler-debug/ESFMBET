import { useAuth } from "./hooks/useAuthHook";
import { Navigate } from "react-router-dom";

const Login = () => {
  const { user, loginWithGoogle } = useAuth();

  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 max-w-sm w-full text-center">
        <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">ESFM <span className="text-green-500">BET</span></h1>
        <p className="text-slate-400 mb-8 font-medium">Predicciones Mundial 2026</p>
        
        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-4 px-6 rounded-2xl hover:bg-slate-100 transition-all active:scale-95 shadow-lg"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          Ingresar con Google
        </button>
        
        <p className="mt-8 text-xs text-slate-500">Al ingresar, aceptas las reglas de fair play de ESFM BET.</p>
      </div>
    </div>
  );
};

export default Login;