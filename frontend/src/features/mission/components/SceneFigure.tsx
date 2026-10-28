import { cn } from '@/lib/utils'

interface SceneFigureProps {
  src: string
  name: string
  role?: string
  speaking: boolean
  mirrored?: boolean
  /** El personaje no entiende lo que le han dicho: se inclina y saca un «?». */
  confused?: boolean
  glow: string
}

export function SceneFigure({
  src,
  name,
  role,
  speaking,
  mirrored = false,
  confused = false,
  glow,
}: SceneFigureProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-end transition-all duration-500',
        speaking || confused ? 'scale-100' : 'scale-95',
      )}
    >
      <div
        className={cn(
          'relative aspect-square w-[min(42vw,13rem,26vh)] transition-all duration-500 drop-shadow-[0_18px_26px_rgba(0,0,0,0.55)] lg:w-[min(16vw,18rem,34vh)]',
          mirrored && '-scale-x-100',
          !speaking && !confused && 'opacity-45 grayscale',
          confused && 'rotate-2',
        )}
      >
        {confused && (
          <span
            className="absolute -top-1 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 animate-bounce items-center justify-center rounded-full border-2 border-cyan/60 bg-slate-950/95 font-poppins text-xl font-bold text-cyan shadow-[0_0_18px_rgba(6,182,212,0.7)]"
            title="No te ha entendido"
          >
            ?
          </span>
        )}
        <img src={src} alt={name} className={cn('h-full w-full', speaking && glow)} />
      </div>
      <div className="mt-1 text-center">
        <p className={cn('text-sm font-bold transition-colors', speaking ? 'text-white' : 'text-slate-400')}>{name}</p>
        {role && <p className="text-[10px] text-slate-500">{role}</p>}
      </div>
    </div>
  )
}
