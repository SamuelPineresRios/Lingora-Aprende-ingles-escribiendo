/**
 * Cabecera de la misión: el título y la descripción de la escena, escritos
 * poco a poco con sonido de teclas sobre un fondo semi negro.
 *
 * Aparece una sola vez al abrir la misión, antes de la escena narrativa: al
 * terminar (o al saltarla con un clic o una tecla), todo se desvanece y entra
 * la escena. Respeta `prefers-reduced-motion`: sin animación, el texto sale
 * completo y la pausa es más corta.
 */
import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MissionBackdrop } from '@vox/shared'
import { MissionBackdrop as MissionBackdropLayer } from './MissionBackdrop'
import { preloadAvatar, preloadAvatars, type AvatarGender } from '@/lib/avatar'
import { playKeySound } from '@/lib/key-sound'

/** Milisegundos que el texto completo se queda en pantalla antes de irse. */
const HOLD_MS = 1700
const REDUCED_HOLD_MS = 800
/** Duración del fundido de salida (debe coincidir con `duration-500`). */
const FADE_MS = 480

interface MissionTitleCardProps {
  title: string
  description: string
  backdrop?: MissionBackdrop | null
  seed?: string
  /** Personajes de la escena: sus avatares se precargan mientras se lee. */
  characters?: Array<{ name: string; gender?: AvatarGender }>
  /** Avatar personalizado del alumno (su papel), también se precarga. */
  studentAvatar?: string | null
  onDone: () => void
}

export function MissionTitleCard({ title, description, backdrop, seed, characters, studentAvatar, onDone }: MissionTitleCardProps) {
  /** Sin animación: el texto sale completo desde el principio y la pausa es más corta. */
  const [reduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  )
  const [typedTitle, setTypedTitle] = useState(reduced ? title : '')
  const [typedDescription, setTypedDescription] = useState(reduced ? description : '')
  const [leaving, setLeaving] = useState(false)
  const [soundOn, setSoundOn] = useState(true)

  /** El bucle de escritura lee el sonido actual sin reiniciarse al silenciarlo. */
  const soundRef = useRef(true)
  useEffect(() => {
    soundRef.current = soundOn
  }, [soundOn])

  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  // Los avatares se piden ya: al entrar la escena, están en caché.
  useEffect(() => {
    if (characters && characters.length > 0) preloadAvatars(characters)
    if (studentAvatar) preloadAvatar(studentAvatar)
  }, [characters, studentAvatar])

  const typingDone = typedTitle.length === title.length && typedDescription.length === description.length

  // Máquina de escribir: primero el título, luego la descripción, con pausas
  // naturales tras los signos de puntuación.
  useEffect(() => {
    if (reduced) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const step = (index: number) => {
      if (cancelled) return
      const inTitle = index < title.length
      if (inTitle) setTypedTitle(title.slice(0, index + 1))
      else setTypedDescription(description.slice(0, index - title.length + 1))
      if (soundRef.current) playKeySound()

      const next = index + 1
      if (next >= title.length + description.length) return

      const char = next < title.length ? title[next - 1] : description[next - title.length - 1]
      const pause = /[.,;:!?]/.test(char ?? '') ? 190 : 0
      const speed = next < title.length ? 46 + Math.random() * 38 : 20 + Math.random() * 24
      timer = setTimeout(() => step(next), speed + pause)
    }

    timer = setTimeout(() => step(0), 260)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [title, description, reduced])

  // Terminado el texto: pausa, se desvanece y entra la escena.
  useEffect(() => {
    if (!typingDone || leaving) return
    const hold = setTimeout(() => setLeaving(true), reduced ? REDUCED_HOLD_MS : HOLD_MS)
    return () => clearTimeout(hold)
  }, [typingDone, leaving, reduced])

  useEffect(() => {
    if (!leaving) return
    const done = setTimeout(() => onDoneRef.current(), FADE_MS)
    return () => clearTimeout(done)
  }, [leaving])

  // Un clic o una tecla: completa el texto y salta a la escena de una vez.
  const skip = () => {
    if (leaving) return
    if (!typingDone) {
      setTypedTitle(title)
      setTypedDescription(description)
    }
    setLeaving(true)
  }

  useEffect(() => {
    const onKey = () => skip()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // `skip` se re-crea en cada render a propósito: siempre ve el estado actual.
  })

  const caret = (
    <span className="ml-1 inline-block h-[1em] w-[3px] translate-y-[0.1em] animate-pulse rounded bg-cyan align-baseline" />
  )

  return (
    <div
      onClick={skip}
      className={cn(
        'fixed inset-0 z-50 cursor-pointer overflow-hidden bg-slate-950/95 transition-all duration-500 ease-out',
        leaving ? 'pointer-events-none scale-[0.985] opacity-0' : 'scale-100 opacity-100',
      )}
    >
      {/* El lugar de la misión, muy apagado, bajo el velo semi negro */}
      {backdrop && <MissionBackdropLayer backdrop={backdrop} seed={seed} variant="scene" className="opacity-15" />}
      <div className="absolute inset-0 bg-slate-950/75" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="flex min-h-[6.5rem] items-end sm:min-h-[8rem]">
          <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-5xl">
            {typedTitle}
            {!typingDone && typedDescription.length === 0 && caret}
          </h1>
        </div>
        <p className="font-reading mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
          {typedDescription}
          {!typingDone && typedDescription.length > 0 && caret}
        </p>
      </div>

      <button
        onClick={event => {
          event.stopPropagation()
          setSoundOn(value => !value)
        }}
        aria-label={soundOn ? 'Silenciar el sonido de teclas' : 'Activar el sonido de teclas'}
        className="absolute bottom-6 right-6 z-20 rounded-lg border border-white/10 p-2 text-slate-400 transition-colors hover:text-white"
      >
        {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>

      <p className="absolute bottom-7 left-1/2 z-20 -translate-x-1/2 text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500">
        Clic para continuar
      </p>
    </div>
  )
}
