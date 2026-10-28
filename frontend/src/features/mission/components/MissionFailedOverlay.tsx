import { CHALLENGE_MISSION_SECONDS, formatClock } from '@vox/shared'

interface MissionFailedOverlayProps {
  open: boolean
  timeUp: boolean
  onRetry: () => void
  onDismiss: () => void
}

export function MissionFailedOverlay({
  open,
  timeUp,
  onRetry,
  onDismiss,
}: MissionFailedOverlayProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,red_20deg,transparent_40deg)] opacity-10 animate-[spin_8s_linear_infinite]" />
      </div>

      <div className="relative z-10 text-center space-y-6 p-8 max-w-md w-full">
        <div className="mx-auto w-24 h-24 bg-red-400/15 rounded-full flex items-center justify-center border-2 border-red-400 shadow-[0_0_30px_rgba(248,113,113,0.4)]">
          <span className="text-5xl">{timeUp ? '⏱️' : '💔'}</span>
        </div>

        <div className="space-y-2">
          <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-red-200 uppercase tracking-tighter drop-shadow-lg">
            Desafío<br />Fallido
          </h2>
          <p className="text-red-200 font-body text-sm tracking-[0.2em] animate-pulse">
            {timeUp
              ? `SE ACABÓ EL TIEMPO (${formatClock(CHALLENGE_MISSION_SECONDS)})`
              : 'TE QUEDASTE SIN CORAZONES'}
          </p>
        </div>

        <p className="text-red-100/80 text-base font-light leading-relaxed max-w-xs mx-auto">
          {timeUp
            ? 'El Desafío dura 3:00 en total. Vuelve a intentarlo y administra mejor el tiempo de la conversación.'
            : 'Repasa las correcciones de la lista de la derecha y vuelve a intentarlo: en el Desafío cada frase fuera de tema o mal escrita cuesta un corazón.'}
        </p>

        <div className="flex flex-col gap-3 w-full pt-2">
          <button
            onClick={onRetry}
            className="w-full py-4 rounded-xl bg-white text-red-900 font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-all active:scale-95"
          >
            Reintentar
          </button>
          {!timeUp && (
            <button
              onClick={onDismiss}
              className="w-full py-3 text-red-200/60 font-body text-xs uppercase tracking-widest hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              [ Volver al desafío ]
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
