export function MissionSubmittingOverlay() {
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-2 border-cyan/20 rounded-full animate-ping" />
        <div className="absolute inset-0 border-2 border-t-cyan border-r-transparent border-b-cyan/50 border-l-transparent rounded-full animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-cyan font-body text-sm font-bold uppercase tracking-[0.25em] animate-pulse">
          Generando tu reporte
        </p>
        <p className="text-[11px] text-slate-400 font-body">
          Evaluando tus frases con el coach… esto tarda unos segundos
        </p>
      </div>
    </div>
  )
}
