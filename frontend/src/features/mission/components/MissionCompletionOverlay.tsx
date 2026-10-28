import { useEffect, useState } from 'react'
import { TypewriterMessage } from '@/components/TypewriterMessage'

interface MissionCompletionOverlayProps {
  open: boolean
  onSubmit: () => void
  onContinue: () => void
}

export function MissionCompletionOverlay({
  open,
  onSubmit,
  onContinue,
}: MissionCompletionOverlayProps) {
  const [typed, setTyped] = useState(false)
  const [actions, setActions] = useState(false)

  useEffect(() => {
    if (!typed) return
    const timer = setTimeout(() => setActions(true), 900)
    return () => clearTimeout(timer)
  }, [typed])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-1000">
      <div className="relative z-10 w-full max-w-md px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
          <TypewriterMessage
            text="Misión completada"
            isActive
            speed={75}
            onComplete={() => setTyped(true)}
          />
        </h2>

        {typed && (
          <div className="animate-in fade-in duration-700">
            <div className="mx-auto mt-8 h-px w-12 bg-cyan/40" />
            <p className="mt-8 text-[11px] font-mono uppercase tracking-[0.3em] text-cyan-200/70">
              Objetivos al 100 %
            </p>
          </div>
        )}

        {actions && (
          <div className="mt-12 flex flex-col gap-3 animate-in fade-in duration-700">
            <button
              onClick={onSubmit}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-bold uppercase tracking-widest text-cyan-950 transition-colors hover:bg-cyan-50 active:scale-[0.99]"
            >
              Enviar informe
            </button>
            <button
              onClick={onContinue}
              className="w-full rounded-xl py-3 text-[11px] font-mono uppercase tracking-widest text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Seguir en la simulación
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
