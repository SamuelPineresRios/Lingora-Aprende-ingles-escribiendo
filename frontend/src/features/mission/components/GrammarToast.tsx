/**
 * Notificación de corrección (sustituye al modal a pantalla completa).
 *
 * Aparece en la esquina cuando el coach valora la frase con 1-3: muestra qué
 * dijo el alumno, cómo se dice bien y el porqué. No bloquea el chat y NO se
 * va sola: permanece hasta que el alumno la cierra.
 */
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GrammarNotice {
  id: string
  /** La frase tal y como la escribió el alumno. */
  original: string
  /** Cómo se dice bien. */
  corrected: string
  /** Explicación del coach, en español. */
  feedback: string
}

function GrammarToast({
  notice,
  onDismiss,
}: {
  notice: GrammarNotice
  onDismiss: (id: string) => void
}) {
  return (
    <div
      role="status"
      className={cn(
        'w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-amber-500/40 bg-slate-900/95 p-3.5 shadow-[0_0_25px_rgba(0,0,0,0.6)] backdrop-blur-sm',
        'animate-in slide-in-from-right-5 fade-in duration-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
          ⚠️ No te entendí bien
        </p>
        <button
          onClick={() => onDismiss(notice.id)}
          aria-label="Cerrar"
          className="text-slate-500 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 space-y-2">
        <div className="rounded-lg border border-red-500/25 bg-red-950/25 px-2.5 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">Lo que dijiste</p>
          <p className="mt-0.5 text-xs italic text-red-200">"{notice.original}"</p>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Forma correcta</p>
          <p className="mt-0.5 text-xs font-semibold italic text-emerald-200">"{notice.corrected}"</p>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-300">{notice.feedback}</p>
      </div>
    </div>
  )
}

/**
 * Pila de notificaciones, anclada a la esquina superior derecha.
 *
 * Permanecen hasta que el alumno las cierra; apilando se ven varias seguidas.
 */
export function GrammarToastStack({
  notices,
  onDismiss,
}: {
  notices: GrammarNotice[]
  onDismiss: (id: string) => void
}) {
  if (notices.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[200] flex max-h-[80vh] flex-col gap-2 overflow-y-auto"
    >
      {/* Sólo el contenedor interior captura eventos: las tarjetas son clicables. */}
      <div className="pointer-events-auto flex flex-col gap-2">
        {notices.map(notice => (
          <GrammarToast key={notice.id} notice={notice} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  )
}

/**
 * Medidor de corazones del Desafío.
 *
 * Los perdidos se apagan; al quedarse sin corazones el desafío termina.
 */
export function HeartMeter({ hearts, total }: { hearts: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-2" title="Cada frase mal cuesta un corazón">
      <span className="text-[0.7rem] text-slate-400 font-body uppercase tracking-widest">Intentos</span>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, index) => {
          const lost = index >= hearts
          return (
            <span
              key={index}
              className={cn(
                'text-base transition-all duration-500',
                lost ? 'opacity-20 grayscale scale-90' : 'opacity-100',
              )}
              aria-label={lost ? 'corazón perdido' : 'corazón disponible'}
            >
              {lost ? '🖤' : '❤️'}
            </span>
          )
        })}
      </div>
      <span className="text-[10px] text-slate-500 font-mono">{hearts}/{total}</span>
    </div>
  )
}
