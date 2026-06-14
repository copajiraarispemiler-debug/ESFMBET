

const Loading = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Efecto de resplandor de fondo */}
        <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full animate-pulse"></div>
        
        {/* Balón girando */}
        <div className="text-6xl animate-spin-slow select-none relative z-10">
          ⚽
        </div>
      </div>
      
      <div className="flex flex-col items-center animate-bounce mt-4">
        <p className="text-white font-black italic text-2xl tracking-tighter uppercase">
          ESFM <span className="text-green-500">BET</span>
        </p>
        <div className="w-12 h-1 bg-green-500/30 rounded-full mt-1 overflow-hidden">
          <div className="w-full h-full bg-green-500 animate-loading-bar"></div>
        </div>
      </div>
    </div>
  );
};

export default Loading;