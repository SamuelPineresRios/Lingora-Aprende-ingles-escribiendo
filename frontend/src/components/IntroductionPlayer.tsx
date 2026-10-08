/**
 * Escena narrativa de la misión (fase 2 del flujo).
 *
 * Planteada como una conversación de lado a lado: los dos personajes se
 * enfrentan en bustos grandes y la burbuja aparece del lado del que habla.
 * El texto se revela palabra a palabra y cada frase se puede escuchar.
 */
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Volume2, X, Languages, SkipForward, Loader2 } from 'lucide-react'
import { resolveAvatar, type IntroductionCharacter, type MissionIntroduction } from '@vox/shared'
import { cn } from '@/lib/utils'
import { TypewriterMessage } from './TypewriterMessage'
import { InteractiveWords } from './InteractiveWords'
import { MissionBackdrop } from './MissionBackdrop'
import { characterAvatarUrl, studentAvatarUrl } from '@/lib/avatar'
import { useAuth } from '@/lib/hooks/useAuth'
import { resolveBackdrop } from '@/lib/mission-backdrop'
import { warmWords } from '@/lib/word-cache'

/** Milisegundos que espera el modo automático tras terminar la frase. */
const AUTOPLAY_NEXT_DELAY_MS = 2400

/**
 * Pausa en «Escena completada» antes de entrar sola al vocabulario: da tiempo
 * a leer las expresiones desbloqueadas sin obligar a pulsar nada.
 */
const SCENE_AUTO_CONTINUE_MS = 2000

/** URL del MP3 sintetizado por el backend (voz natural y cacheada). */
function speechUrl(text: string, role: 'A' | 'B'): string {
  return `/api/tts?voice=${role.toLowerCase()}&text=${encodeURIComponent(text)}`
}

/**
 * Nivel de boca (0-1) cuando no hay audio que analizar: voz apagada, voz
 * nativa de reserva o el audio aún cargando. Dos senos de periodos distintos
 * dan un abrir y cerrar irregular, más parecido al habla que un latido fijo.
 */
function syntheticMouthLevel(now: number): number {
  const fast = 0.5 + 0.5 * Math.sin(now / 55)
  const slow = 0.5 + 0.5 * Math.sin(now / 190 + 1.3)
  return 0.15 + 0.85 * fast * slow
}

/**
 * Identidad visual de cada rol: color del nombre, del texto, de la burbuja y
 * brillo del avatar. Son clases completas porque Tailwind no genera nombres
 * construidos.
 */
const ROLE_THEME: Record<'A' | 'B', { label: string; text: string; glow: string; dot: string }> = {
  A: {
    label: 'text-cyan',
    text: 'text-cyan-50',
    glow: 'drop-shadow-[0_0_26px_rgba(6,182,212,0.5)]',
    dot: 'bg-cyan',
  },
  B: {
    label: 'text-violet',
    text: 'text-violet-50',
    glow: 'drop-shadow-[0_0_26px_rgba(139,92,246,0.5)]',
    dot: 'bg-violet',
  },
}

/** Color del badge por nivel, para que el nivel se lea de un vistazo. */
const CEFR_BADGE: Record<string, string> = {
  A1: 'border-emerald/50 bg-emerald/10 text-emerald',
  A2: 'border-cyan/50 bg-cyan/10 text-cyan',
  B1: 'border-amber/50 bg-amber/10 text-amber',
  B2: 'border-violet/50 bg-violet/10 text-violet',
  C1: 'border-coral/50 bg-coral/10 text-coral',
}

interface IntroductionPlayerProps {
  introduction: MissionIntroduction
  cefrLevel: string
  onFinish: () => void
  onSkip: () => void
  /** Salta también el vocabulario y el emparejamiento, directo a la misión. */
  onSkipToMission: () => void
}

/** Avatar grande de un personaje, resaltado cuando le toca hablar. */
function CharacterStage({
  character,
  avatarSrc,
  speaking,
  finished,
  mirrored,
  mouthRef,
}: {
  character: IntroductionCharacter
  /** Avatar con el que se dibuja (el del alumno en su propio papel). */
  avatarSrc: string
  speaking: boolean
  finished: boolean
  /**
   * El personaje de la derecha se pinta en espejo para que mire hacia el de la
   * izquierda; se voltea el bloque entero (avatar + boca) y los textos de
   * debajo quedan fuera, así que no se invierten.
   */
  mirrored?: boolean
  /** Pieza de la boca: el reproductor le escribe el nivel por CSS. */
  mouthRef: RefObject<HTMLSpanElement>
}) {
  const theme = ROLE_THEME[character.id]
  return (
    <div className={cn('flex flex-col items-center justify-end transition-all duration-500', speaking ? 'scale-100' : 'scale-95')}>
      <div
        className={cn(
          // El ancho responde al viewport: en móvil manda el ancho de la
          // columna, en escritorio el alto de la pantalla (para que el avatar
          // nunca desplace la burbuja ni el pie en portátiles bajos). En
          // pantallas altas se permite crecer más.
          // Sin marco: el sprite va suelto sobre la escena y la sombra es un
          // `drop-shadow`, que sigue su silueta en vez de dibujar una caja.
          'relative aspect-square w-[min(42vw,11rem,36vh)] sm:w-[min(29vw,25rem,38vh)] [@media(min-height:840px)]:sm:w-[min(29vw,25rem,42vh)] transition-all duration-500 drop-shadow-[0_18px_26px_rgba(0,0,0,0.55)]',
          mirrored && '-scale-x-100',
          !speaking && 'opacity-55 grayscale',
        )}
      >
        {/* El sprite voxel-art ya trae el personaje completo y centrado en su
            lienzo cuadrado: se muestra entero, sin marco ni recortes. */}
        <img
          src={avatarSrc}
          alt={character.name}
          className={cn('h-full w-full', speaking && theme.glow)}
        />

        {/* Boca animada. La rejilla del sprite voxel la sitúa en x 48-59,4 %
            e y 57,8-63,3 % del lienzo (medido sobre el SVG de DiceBear);
            encima va esta pieza, que crece con el volumen real de la voz. A
            nivel 0 queda invisible y se ve la boca original. */}
        <span className="pointer-events-none absolute inset-0" aria-hidden>
          <span
            ref={mouthRef}
            className="absolute left-[48%] top-[57.8%] w-[11.4%] rounded-[3px] bg-[#261910]"
            style={{ height: 'calc(var(--mouth-open, 0) * 5.5%)' }}
          />
        </span>

        {speaking && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]', theme.dot)} />
            <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]', theme.dot)} />
            <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]', theme.dot)} />
          </span>
        )}
      </div>

      <div className="mt-2 text-center">
        <p className={cn('text-base font-bold transition-colors', speaking ? 'text-white' : 'text-slate-400')}>
          {character.name}
        </p>
        <p className="text-[11px] text-slate-500">{character.role}</p>
        <p className={cn('text-[9px] font-mono uppercase tracking-widest mt-0.5', speaking ? theme.label : 'text-slate-600')}>
          {finished ? '—' : speaking ? '● hablando' : character.played_by === 'ai' ? 'lo interpreta la IA' : 'tu papel'}
        </p>
      </div>
    </div>
  )
}

export function IntroductionPlayer({ introduction, cefrLevel, onFinish, onSkip, onSkipToMission }: IntroductionPlayerProps) {
  const { user } = useAuth()
  /** El personaje que interpreta el alumno lleva su avatar personalizado. */
  const studentAvatar = user ? studentAvatarUrl(resolveAvatar({ id: user.id, avatar: user.avatar })) : null
  const [index, setIndex] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [showTranslations, setShowTranslations] = useState(false)
  /**
   * La narración empieza sonando: la primera frase se lee nada más montar la
   * escena. El clic que abrió la misión da la activación que exige el
   * navegador para reproducir audio.
   */
  const [voice, setVoice] = useState(true)
  const [finished, setFinished] = useState(false)
  /** Se pone a true cuando la frase actual termina de escribirse. */
  const [lineComplete, setLineComplete] = useState(false)
  const voiceRef = useRef(voice)
  voiceRef.current = voice
  /** Audio en curso del backend; se corta al cambiar de frase. */
  const audioRef = useRef<HTMLAudioElement | null>(null)
  /** Se enciende mientras suena algo (backend o voz nativa): mantiene la boca. */
  const [audioPlaying, setAudioPlaying] = useState(false)
  /** Analizador de la voz en curso; null si no hay audio que analizar. */
  const analyserRef = useRef<AnalyserNode | null>(null)
  /** AudioContext compartido: se crea al primer uso y vive con la escena. */
  const audioContextRef = useRef<AudioContext | null>(null)
  /** Búfer reutilizado por el analizador (no reservar 60 veces por segundo). */
  const levelBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  /** Boca de cada personaje: el bucle de animación le escribe el nivel. */
  const mouthARef = useRef<HTMLSpanElement | null>(null)
  const mouthBRef = useRef<HTMLSpanElement | null>(null)

  const total = introduction.lines.length
  const line = introduction.lines[Math.min(index, total - 1)]
  const nextLine = introduction.lines[index + 1]
  const lineText = line?.text
  const lineSpeaker = line?.speaker
  const speaker = introduction.characters.find(character => character.id === line?.speaker)
  const isLastLine = index >= total - 1

  /**
   * AudioContext compartido para analizar la voz. Devuelve null mientras el
   * navegador lo mantenga suspendido (sin activación del usuario): en ese
   * caso el audio se reproduce igual, sin pasar por el analizador, y la boca
   * usa la animación sintética.
   */
  const ensureAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      try {
        audioContextRef.current = new AudioContext()
      } catch {
        return null
      }
    }
    const context = audioContextRef.current
    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch {
        // Sin activación seguimos: la boca caerá a la animación sintética.
      }
    }
    return context.state === 'running' ? context : null
  }, [])

  /** Corta la voz actual (la del backend o la nativa). */
  const stopVoice = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    analyserRef.current = null
    window.speechSynthesis?.cancel()
    setAudioPlaying(false)
  }, [])

  /** Reserva: la voz nativa del navegador, para móviles y equipos sin clave. */
  const speakNative = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.95
    utterance.onstart = () => setAudioPlaying(true)
    utterance.onend = () => setAudioPlaying(false)
    utterance.onerror = () => setAudioPlaying(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  /**
   * Lee una frase con la voz natural del backend. Si no hay clave, cuota o
   * red, cae a la voz nativa del navegador (si la tiene).
   *
   * El audio se enruta por un `AnalyserNode` para que la boca del personaje
   * siga el volumen real de la voz. Si el AudioContext no arranca (política
   * de autoplay) el audio suena igual y la boca se anima en sintético.
   */
  const speak = useCallback(
    async (text: string, role: 'A' | 'B') => {
      stopVoice()
      const audio = new Audio(speechUrl(text, role))
      audioRef.current = audio
      audio.addEventListener('ended', () => setAudioPlaying(false))
      audio.addEventListener('pause', () => setAudioPlaying(false))

      const context = await ensureAudioContext()
      // Mientras se preparaba el contexto pudo cambiar la frase: no pisar.
      if (audioRef.current !== audio) return

      if (context) {
        try {
          const source = context.createMediaElementSource(audio)
          const analyser = context.createAnalyser()
          analyser.fftSize = 512
          analyser.smoothingTimeConstant = 0.55
          source.connect(analyser)
          analyser.connect(context.destination)
          analyserRef.current = analyser
        } catch (err) {
          console.warn('[voz] No se pudo analizar el audio:', err)
          analyserRef.current = null
        }
      }

      try {
        await audio.play()
        if (audioRef.current === audio) setAudioPlaying(true)
      } catch {
        analyserRef.current = null
        if (audioRef.current === audio) {
          setAudioPlaying(false)
          speakNative(text)
        }
      }
    },
    [stopVoice, speakNative, ensureAudioContext],
  )

  // Al cambiar de frase: se marca como no escrita y se lee si la voz está activa.
  // Las dependencias son el texto y el hablante, no el objeto `line`: si el
  // padre vuelve a entregar la introducción (nuevo objeto con el mismo
  // contenido), no debe repetirse la frase ni cortarse la que suena.
  useEffect(() => {
    if (!lineText || !lineSpeaker) return
    setLineComplete(false)
    if (voiceRef.current) speak(lineText, lineSpeaker)
    return stopVoice
  }, [lineText, lineSpeaker, speak, stopVoice])

  // Precalienta el MP3 de la siguiente frase: al llegar, suena sin espera.
  useEffect(() => {
    if (!voice || !nextLine) return
    fetch(speechUrl(nextLine.text, nextLine.speaker)).catch(() => {})
  }, [voice, nextLine])

  /**
   * Calienta en el backend las palabras de toda la escena mientras el alumno
   * la lee: cuando pase el cursor, la ficha ya estará generada. Se manda el
   * orden de aparición (primero las primeras líneas, que son las que antes se
   * miran).
   */
  useEffect(() => {
    warmWords([...introduction.lines.map(line => line.text), ...introduction.useful_expressions])
  }, [introduction])

  /**
   * Nivel actual de la boca (0-1): el volumen real de la voz si hay audio
   * sonando, o la animación sintética si no (voz apagada, voz nativa o audio
   * aún cargando).
   */
  const readMouthLevel = useCallback((): number => {
    const analyser = analyserRef.current
    if (!analyser) return syntheticMouthLevel(performance.now())

    if (!levelBufferRef.current || levelBufferRef.current.length !== analyser.fftSize) {
      levelBufferRef.current = new Uint8Array(analyser.fftSize)
    }
    const samples = levelBufferRef.current
    analyser.getByteTimeDomainData(samples)
    let sum = 0
    for (const sample of samples) {
      const value = (sample - 128) / 128
      sum += value * value
    }
    const rms = Math.sqrt(sum / samples.length)
    // El habla ronda 0,05-0,2 de RMS: se estira y se recorta a 0-1.
    return Math.min(1, Math.max(0, (rms - 0.02) * 6))
  }, [])

  /**
   * La boca se mueve mientras el personaje está entregando su frase: mientras
   * se escribe el texto o mientras sigue sonando el audio. Se escribe la
   * variable CSS directamente en el DOM para no re-renderizar a 60 fps.
   */
  const talkingRole =
    !finished && speaker && (!lineComplete || audioPlaying) ? speaker.id : null

  useEffect(() => {
    if (!talkingRole) return
    const mouthRef = talkingRole === 'A' ? mouthARef : mouthBRef

    let raf = 0
    const tick = () => {
      mouthRef.current?.style.setProperty('--mouth-open', readMouthLevel().toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      mouthRef.current?.style.setProperty('--mouth-open', '0')
    }
  }, [talkingRole, readMouthLevel])

  const advance = useCallback(() => {
    if (finished) return
    if (isLastLine) {
      stopVoice()
      setFinished(true)
      return
    }
    setIndex(value => value + 1)
  }, [finished, isLastLine, stopVoice])

  // Modo automático: espera a que la frase termine de escribirse y deja un
  // margen de lectura antes de pasar a la siguiente.
  useEffect(() => {
    if (!autoPlay || finished || !lineComplete) return
    const timer = setTimeout(advance, AUTOPLAY_NEXT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [autoPlay, finished, lineComplete, index, advance])

  /**
   * `onFinish` en un ref: la cuenta atrás de abajo no debe reiniciarse porque
   * el padre vuelva a renderizar y entregue otra función.
   */
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  // Terminada la escena se pasa solo al vocabulario: sin botón que pulsar.
  // Si el alumno pulsa «Repetir» antes, el cambio a `finished = false` limpia
  // el temporizador y se queda a ver la escena de nuevo.
  useEffect(() => {
    if (!finished) return
    const timer = setTimeout(() => onFinishRef.current(), SCENE_AUTO_CONTINUE_MS)
    return () => clearTimeout(timer)
  }, [finished])

  // Espacio o flecha derecha avanzan, como en una novela visual.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'ArrowRight') {
        event.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  const replay = () => {
    stopVoice()
    setIndex(0)
    setFinished(false)
    setAutoPlay(false)
  }

  const toggleVoice = () => {
    const next = !voice
    setVoice(next)
    if (next && line) speak(line.text, line.speaker)
    else stopVoice()
  }

  const readAloud = () => {
    if (!line) return
    speak(line.text, line.speaker)
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 font-body relative overflow-hidden">
      {/* Fondo ambientado según la misión: la dirección de arte generada o,
          si la escena es antigua, el respaldo por palabras clave. El velo
          oscuro mantiene el texto legible sobre cualquier escena. */}
      <MissionBackdrop
        backdrop={resolveBackdrop(
          introduction.backdrop,
          `${introduction.scene_title} ${introduction.scene_description}`,
        )}
        seed={introduction.scene_title}
        variant="scene"
        className="opacity-80"
      />
      <div className="absolute inset-0 bg-slate-950/65" />

      {/* Cabecera */}
      <header className="relative z-10 shrink-0 flex items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
            <h2 className="font-body text-xl sm:text-2xl font-bold text-white truncate">{introduction.scene_title}</h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className={cn('text-xs px-2 py-1 rounded border font-bold', CEFR_BADGE[cefrLevel] ?? CEFR_BADGE.B1)}>
            {cefrLevel}
          </span>
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-white text-[11px] font-mono uppercase tracking-widest flex items-center gap-1 whitespace-nowrap"
          >
            <X className="h-4 w-4" /> Saltar escena
          </button>
          <button
            onClick={onSkipToMission}
            className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-cyan/40 bg-cyan/10 px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-widest text-cyan transition-colors hover:bg-cyan/20"
          >
            <SkipForward className="h-3.5 w-3.5" /> Saltar a la misión
          </button>
        </div>
      </header>

      {/* Escenario + personajes */}
      <div className="relative z-10 shrink-0 px-6">
        <p className="text-[13px] sm:text-[15px] text-cyan-50/90 leading-relaxed border-l-2 border-cyan/40 pl-3">
          {introduction.scene_description}
        </p>
      </div>

      {/* Personajes: centrados verticalmente en el escenario, por encima de la
          burbuja (que vive en su propio bloque al pie). */}
      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-1 sm:px-6 py-4">
        <div className="grid w-full grid-cols-2 gap-1 sm:gap-16 items-end justify-items-center">
          {introduction.characters.map((character, index) => (
            <CharacterStage
              key={character.id}
              character={character}
              avatarSrc={
                character.played_by === 'student' && studentAvatar
                  ? studentAvatar
                  : characterAvatarUrl(character.name, character.gender)
              }
              speaking={!finished && speaker?.id === character.id}
              finished={finished}
              mirrored={index === 1}
              mouthRef={character.id === 'A' ? mouthARef : mouthBRef}
            />
          ))}
        </div>
      </div>

      {/* Burbuja: aparece del lado del personaje que habla */}
      <div className="relative z-10 shrink-0 px-6 pb-2">
        <div
          className={cn(
            'w-full max-w-2xl transition-all duration-300',
            speaker?.id === 'A' ? 'mr-auto' : 'ml-auto',
          )}
        >
          {/* Sin caja: solo el texto del rol, sobre la escena. El alto mínimo
              evita que la escena salte al cambiar de frase. */}
          <div className="relative min-h-[132px] flex flex-col justify-center px-2 py-4 sm:px-4">
            {line && !finished && (
              <>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className={cn('text-[10px] font-mono uppercase tracking-widest', speaker ? ROLE_THEME[speaker.id].label : 'text-cyan')}>
                    {speaker?.name}
                  </p>
                  <div className="flex items-center gap-3">
                    {!lineComplete && (
                      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 animate-pulse">
                        escribiendo…
                      </span>
                    )}
                    <button
                      onClick={readAloud}
                      title="Escuchar esta frase"
                      aria-label="Escuchar esta frase"
                      className={cn(
                        'transition-colors hover:text-white',
                        speaker ? ROLE_THEME[speaker.id].label : 'text-cyan',
                      )}
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className={cn('font-reading text-xl sm:text-2xl leading-relaxed font-medium tracking-[0.01em] drop-shadow-[0_2px_12px_rgba(2,6,23,0.95)]', speaker ? ROLE_THEME[speaker.id].text : 'text-slate-100')}>
                  {lineComplete ? (
                    <InteractiveWords text={line.text} context={line.text} />
                  ) : (
                    <TypewriterMessage text={line.text} isActive speed={26} onComplete={() => setLineComplete(true)} />
                  )}
                </p>

                {showTranslations && lineComplete && (
                  <p className="font-reading mt-3 text-[15px] italic text-emerald-200/90 drop-shadow-[0_2px_10px_rgba(2,6,23,0.95)] animate-in fade-in duration-500">
                    {line.translation}
                  </p>
                )}
              </>
            )}

            {finished && (
              <div className="text-center space-y-2">
                <p className="text-xl sm:text-2xl font-black text-emerald">Escena completada</p>
                <p className="text-[13px] text-slate-300">
                  Desbloqueaste {introduction.useful_expressions.length} expresiones para la misión
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progreso y controles */}
      <footer className="relative z-10 shrink-0 px-6 pb-5 space-y-3">
        {/* Un punto por frase: se encienden al avanzar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Diálogo</span>
          <div className="flex-1 flex items-center gap-1.5">
            {introduction.lines.map((_, lineIndex) => (
              <span
                key={lineIndex}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-all duration-500',
                  lineIndex < index || finished
                    ? 'bg-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                    : lineIndex === index
                      ? 'bg-cyan/60 animate-pulse'
                      : 'bg-slate-800',
                )}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{finished ? total : index + 1}/{total}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAutoPlay(value => !value)}
              disabled={finished}
              className={cn(
                'px-3 py-2 rounded-lg border text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-40',
                autoPlay ? 'border-amber/50 bg-amber/10 text-amber' : 'border-white/10 text-slate-300 hover:border-white/30',
              )}
            >
              {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoPlay ? 'Pausar' : 'Automático'}
            </button>
            <button
              onClick={advance}
              disabled={finished}
              className="px-5 py-2 rounded-lg bg-cyan text-black text-[11px] font-mono font-bold uppercase tracking-widest transition-colors hover:bg-cyan-400 disabled:opacity-40 flex items-center gap-1.5"
            >
              Siguiente <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowTranslations(value => !value)}
              className={cn(
                'px-3 py-2 rounded-lg border text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5 transition-colors',
                showTranslations ? 'border-emerald/50 bg-emerald/10 text-emerald' : 'border-white/10 text-slate-300 hover:border-white/30',
              )}
            >
              <Languages className="h-3.5 w-3.5" /> Traducción
            </button>
            <button
              onClick={toggleVoice}
              className={cn(
                'px-3 py-2 rounded-lg border text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5 transition-colors',
                voice ? 'border-cyan/50 bg-cyan/10 text-cyan' : 'border-white/10 text-slate-300 hover:border-white/30',
              )}
            >
              <Volume2 className="h-3.5 w-3.5" /> Voz {voice ? 'on' : 'off'}
            </button>
            <button
              onClick={replay}
              className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:border-white/30 text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Repetir
            </button>
          </div>
        </div>

        {finished && (
          <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 py-4 text-cyan font-mono text-sm uppercase tracking-widest">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pasando al vocabulario…
          </div>
        )}
      </footer>
    </div>
  )
}
