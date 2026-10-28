/**
 * Vocabulario clave: la actividad entre la escena narrativa y la misión.
 *
 * Tres pasos: estudiar las palabras (traducción y ejemplo), emparejarlas con
 * su traducción —con líneas que se dibujan solas— y completar tres frases de
 * la escena eligiendo la palabra que encaja. La evaluación es local.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Eye, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { getCachedVocabulary, setCachedVocabulary, type KeyWord } from '@/lib/mission-content'

type Phase = 'study' | 'match' | 'complete' | 'summary'

/** Frase de la escena con un hueco: la palabra se elige entre tres opciones. */
interface GapQuestion {
  word: string
  /** Texto antes y después del hueco. */
  before: string
  after: string
  /** Opciones barajadas, con la correcta incluida. */
  options: string[]
  /** Traducción de la frase completa, para el feedback. */
  translation: string
}

/** Línea que une una palabra con su traducción (coordenadas del tablero). */
interface Connector {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  wrong?: boolean
}

/** Animaciones de los conectores: la línea se dibuja y los puntos aparecen. */
const CONNECTOR_KEYFRAMES = `
@keyframes pair-draw { to { stroke-dashoffset: 0 } }
@keyframes pair-pop { from { opacity: 0 } to { opacity: 1 } }
`

interface VocabularyQuizProps {
  missionId: string
  cefrLevel: string
  onFinish: () => void
}

/** Baraja la columna de traducciones (y la rebaraja al repetir). */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy
}

/** Escapa lo que iría dentro de una expresión regular (apóstrofos, guiones...). */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Frase de ejemplo con la palabra clave en negrita.
 *
 * El modelo tiene que devolver el ejemplo con la palabra tal cual; aun así, si
 * no aparece, la frase se pinta sin resaltar en vez de romperse.
 */
function ExampleText({ text, word }: { text: string; word: string }) {
  const pattern = new RegExp(`\\b(${escapeRegExp(word)})\\b`, 'gi')
  const chunks = text.split(pattern)

  return (
    <>
      {chunks.map((chunk, index) =>
        chunk.toLowerCase() === word.toLowerCase() ? (
          <strong key={index} className="font-bold text-white">
            {chunk}
          </strong>
        ) : (
          <span key={index}>{chunk}</span>
        ),
      )}
    </>
  )
}

/** Mensaje final según los fallos. */
function closingMessage(mistakes: number, total: number): string {
  if (mistakes === 0) return `Los ${total} pares a la primera. A por la conversación.`
  if (mistakes <= 3) return 'Buen trabajo: un par de fallos que ya conoces.'
  return 'Vuelve a leer la lista si quieres y entra a la misión: estas palabras saldrán en la conversación.'
}

const GAP_TOTAL = 3

/**
 * Prepara las frases con hueco a partir de los ejemplos de la escena.
 *
 * Elegible toda palabra que aparezca tal cual en su ejemplo (los ejemplos se
 * escribieron para contenerla). El hueco va en esa aparición y los distractores
 * salen de las otras palabras de la misma misión, para que suenen al contexto.
 */
function buildGapQuestions(words: KeyWord[]): GapQuestion[] {
  const candidates = words.flatMap(entry => {
    const match = new RegExp(`\\b${escapeRegExp(entry.word)}\\b`, 'i').exec(entry.example)
    if (!match) return []
    return [{
      word: entry.word,
      before: entry.example.slice(0, match.index),
      after: entry.example.slice(match.index + match[0].length),
      translation: entry.example_translation,
    }]
  })

  return shuffled(candidates).slice(0, GAP_TOTAL).map(question => {
    const others = shuffled(words.filter(entry => entry.word !== question.word).map(entry => entry.word)).slice(0, 2)
    return { ...question, options: shuffled([question.word, ...others]) }
  })
}

export function VocabularyQuiz({ missionId, cefrLevel, onFinish }: VocabularyQuizProps) {
  // Si el vocabulario se precargó durante la cabecera, monta sin pedir nada.
  const [words, setWords] = useState<KeyWord[]>(() => getCachedVocabulary(missionId) ?? [])
  const [loading, setLoading] = useState(() => !(getCachedVocabulary(missionId)?.length))
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [phase, setPhase] = useState<Phase>('study')
  const [rightColumn, setRightColumn] = useState<string[]>([])
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null)
  /** Palabras ya emparejadas (el par se pinta en verde). */
  const [matched, setMatched] = useState<string[]>([])
  /** Par fallado, para el destello rojo antes de soltarlo. */
  const [wrong, setWrong] = useState<{ word: string; translation: string } | null>(null)
  const [mistakes, setMistakes] = useState(0)
  /** Frases con hueco: la tercera actividad. */
  const [gaps, setGaps] = useState<GapQuestion[]>([])
  const [gapIndex, setGapIndex] = useState(0)
  /** Opción elegida en la frase actual (null si aún no respondió). */
  const [gapChoice, setGapChoice] = useState<string | null>(null)
  const [gapMistakes, setGapMistakes] = useState(0)
  /** Líneas del tablero: pares acertados (verde) y el fallo momentáneo (rojo). */
  const [connectors, setConnectors] = useState<Connector[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const wordRefs = useRef(new Map<string, HTMLButtonElement>())
  const translationRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    let cancelled = false

    /** Deja la actividad lista con la lista de palabras. */
    const applyWords = (list: KeyWord[]) => {
      setWords(list)
      setPhase('study')
      setMatched([])
      setMistakes(0)
      setSelectedWord(null)
      setSelectedTranslation(null)
      setWrong(null)
      setRightColumn(shuffled(list.map(entry => entry.translation)))
      setLoading(false)
    }

    // Precargado (cabecera o tarjetas): no hay nada que pedir.
    const cached = getCachedVocabulary(missionId)
    if (cached && cached.length > 0) {
      applyWords(cached)
      return () => {
        cancelled = true
      }
    }

    fetch(`/api/missions/${missionId}/vocabulary`)
      .then(readJson)
      .then(data => {
        if (cancelled) return
        const list: KeyWord[] = data?.vocabulary?.words ?? []
        if (list.length === 0) throw new Error('La actividad llegó vacía')
        setCachedVocabulary(missionId, list)
        applyWords(list)
      })
      .catch(err => {
        if (!cancelled) setError((err as Error).message)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [missionId, reloadKey])

  /** Reintento del botón: el estado visual se marca aquí, no en el efecto. */
  const retryLoad = () => {
    setLoading(true)
    setError(null)
    setReloadKey(key => key + 1)
  }

  const matchedTranslations = new Set(
    words.filter(entry => matched.includes(entry.word)).map(entry => entry.translation),
  )

  const isMatchedWord = (word: string) => matched.includes(word)

  /**
   * Mide dónde están los botones y calcula las líneas del tablero.
   *
   * Se lee del DOM (no de un modelo de posiciones) porque el tamaño de los
   * botones depende del texto: así las líneas caen justo en los bordes aunque
   * cambie el ancho de la pantalla.
   */
  const measure = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const base = board.getBoundingClientRect()

    const next: Connector[] = []
    for (const word of matched) {
      const left = wordRefs.current.get(word)
      const translation = words.find(entry => entry.word === word)?.translation
      const right = translation ? translationRefs.current.get(translation) : undefined
      if (!left || !right) continue
      const leftRect = left.getBoundingClientRect()
      const rightRect = right.getBoundingClientRect()
      next.push({
        id: word,
        x1: leftRect.right - base.left + 5,
        y1: leftRect.top + leftRect.height / 2 - base.top,
        x2: rightRect.left - base.left - 5,
        y2: rightRect.top + rightRect.height / 2 - base.top,
      })
    }

    if (wrong) {
      const left = wordRefs.current.get(wrong.word)
      const right = translationRefs.current.get(wrong.translation)
      if (left && right) {
        const leftRect = left.getBoundingClientRect()
        const rightRect = right.getBoundingClientRect()
        next.push({
          id: `wrong-${wrong.word}`,
          x1: leftRect.right - base.left + 5,
          y1: leftRect.top + leftRect.height / 2 - base.top,
          x2: rightRect.left - base.left - 5,
          y2: rightRect.top + rightRect.height / 2 - base.top,
          wrong: true,
        })
      }
    }

    setConnectors(next)
  }, [matched, wrong, words])

  useEffect(() => {
    measure()
    const board = boardRef.current
    if (!board) return
    const observer = new ResizeObserver(measure)
    observer.observe(board)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const evaluate = (word: string, translation: string) => {
    const entry = words.find(item => item.word === word)
    if (entry?.translation === translation) {
      const pairs = [...matched, word]
      setMatched(pairs)
      setSelectedWord(null)
      setSelectedTranslation(null)
      if (pairs.length === words.length) {
        setTimeout(() => startComplete(), 450)
      }
      return
    }

    setMistakes(value => value + 1)
    setWrong({ word, translation })
    // El destello rojo se suelta solo y deja elegir otra pareja.
    setTimeout(() => {
      setWrong(null)
      setSelectedWord(null)
      setSelectedTranslation(null)
    }, 650)
  }

  const pickWord = (word: string) => {
    if (isMatchedWord(word) || wrong) return
    if (selectedTranslation) {
      evaluate(word, selectedTranslation)
      return
    }
    setSelectedWord(current => (current === word ? null : word))
  }

  const pickTranslation = (translation: string) => {
    if (matchedTranslations.has(translation) || wrong) return
    if (selectedWord) {
      evaluate(selectedWord, translation)
      return
    }
    setSelectedTranslation(current => (current === translation ? null : translation))
  }

  const startMatching = () => {
    setPhase('match')
    setMatched([])
    setMistakes(0)
    setSelectedWord(null)
    setSelectedTranslation(null)
    setWrong(null)
    setRightColumn(shuffled(words.map(entry => entry.translation)))
  }

  const retryMatching = () => {
    startMatching()
  }

  /** Tercera actividad: tres frases de la escena con un hueco que rellenar. */
  const startComplete = () => {
    const questions = buildGapQuestions(words)
    if (questions.length === 0) {
      setPhase('summary')
      return
    }
    setGaps(questions)
    setGapIndex(0)
    setGapChoice(null)
    setGapMistakes(0)
    setPhase('complete')
  }

  const pickGapOption = (option: string) => {
    const question = gaps[gapIndex]
    if (gapChoice !== null || !question) return
    setGapChoice(option)
    if (option !== question.word) setGapMistakes(value => value + 1)
  }

  const nextGap = () => {
    if (gapIndex + 1 >= gaps.length) {
      setPhase('summary')
      return
    }
    setGapIndex(index => index + 1)
    setGapChoice(null)
  }

  const backToStudy = () => {
    setPhase('study')
    setSelectedWord(null)
    setSelectedTranslation(null)
    setWrong(null)
  }

  return (
    <div data-font-legacy className="relative min-h-screen w-full bg-slate-950 overflow-hidden flex flex-col">
      {/* Mismo fondo que la escena, para no romper la continuidad */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(8,51,68,0.6)_0%,rgba(2,6,23,0.97)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0e2a38_1px,transparent_1px),linear-gradient(to_bottom,#0e2a38_1px,transparent_1px)] bg-[size:56px_56px] opacity-20" />

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-coral font-bold">No se pudo cargar el vocabulario</p>
            <p className="text-xs text-slate-400 max-w-xs">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={retryLoad}
                className="px-4 py-2 rounded-lg bg-cyan text-black text-xs font-bold uppercase tracking-widest"
              >
                Reintentar
              </button>
              <button
                onClick={onFinish}
                className="px-4 py-2 rounded-lg border border-white/15 text-slate-300 text-xs uppercase tracking-widest"
              >
                Continuar sin la actividad
              </button>
            </div>
          </div>
        )}

        {/* Fase 1: estudiar las palabras con su ejemplo */}
        {!loading && !error && phase === 'study' && (
          <div className="w-full max-w-2xl">
            <header className="flex items-center justify-between gap-4 mb-2">
              <div>
                <p className="text-[10px] text-cyan uppercase tracking-[0.25em]">Antes de la conversación</p>
                <h2 className="text-xl font-bold text-white">Palabras clave</h2>
              </div>
              <span className="text-xs px-2 py-1 rounded border font-bold border-cyan/50 bg-cyan/10 text-cyan">
                {cefrLevel}
              </span>
            </header>
            <p className="text-[12px] text-slate-400 mb-4">
              Estas son las {words.length} palabras de la escena, con su traducción y un ejemplo. Después las emparejarás y completarás tres frases.
            </p>

            <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-6">
              {words.map((entry, position) => (
                <li
                  key={entry.word}
                  className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-3.5 transition-colors hover:border-cyan/30"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md border border-cyan/30 bg-cyan/10 text-cyan text-[10px] font-mono flex items-center justify-center shrink-0">
                      {String(position + 1).padStart(2, '0')}
                    </span>
                    <p className="text-base font-bold text-white truncate">{entry.word}</p>
                  </div>
                  <div className="mt-2.5">
                    <span className="inline-block text-xs px-2 py-1 rounded-md border border-cyan/30 bg-cyan/10 text-cyan break-words">
                      {entry.translation}
                    </span>
                  </div>
                  <div className="mt-2.5 border-l-2 border-cyan/25 pl-2.5">
                    <p className="text-[13px] leading-snug text-slate-200">
                      <ExampleText text={entry.example} word={entry.word} />
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-slate-500 italic">{entry.example_translation}</p>
                  </div>
                </li>
              ))}
            </ul>

            <button
              onClick={startMatching}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan text-black font-bold text-xs uppercase tracking-widest py-3 transition-colors hover:bg-cyan-400"
            >
              Practicar el emparejamiento <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Fase 2: emparejar palabra con traducción */}
        {!loading && !error && phase === 'match' && (
          <div className="w-full max-w-3xl">
            <header className="flex items-center justify-between gap-4 mb-2">
              <div>
                <p className="text-[10px] text-cyan uppercase tracking-[0.25em]">Palabras clave</p>
                <h2 className="text-xl font-bold text-white">Empareja cada palabra</h2>
              </div>
              <span className="text-xs px-2 py-1 rounded border font-bold border-cyan/50 bg-cyan/10 text-cyan">
                {cefrLevel}
              </span>
            </header>
            <p className="text-[12px] text-slate-400 mb-4">
              Toca una palabra y luego su traducción. Vas {matched.length} de {words.length}
              {mistakes > 0 && <> · {mistakes} fallo{mistakes === 1 ? '' : 's'}</>}.
            </p>

            <div ref={boardRef} className="relative grid grid-cols-2 gap-x-8 sm:gap-x-14 gap-y-2.5 mb-5">
              <div className="space-y-2.5">
                {words.map(entry => {
                  const done = isMatchedWord(entry.word)
                  const failed = wrong?.word === entry.word
                  const selected = selectedWord === entry.word
                  return (
                    <button
                      key={entry.word}
                      ref={element => {
                        if (element) wordRefs.current.set(entry.word, element)
                        else wordRefs.current.delete(entry.word)
                      }}
                      onClick={() => pickWord(entry.word)}
                      disabled={done || wrong !== null}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-sm font-bold transition-all duration-200',
                        done && 'border-emerald/50 bg-emerald/10 text-emerald-200 shadow-[0_0_20px_-8px_rgba(52,211,153,0.9)]',
                        failed && 'border-coral/60 bg-coral/10 text-red-100',
                        !done && !failed && selected && 'border-cyan/60 bg-cyan/10 text-cyan-100 shadow-[0_0_20px_-6px_rgba(6,182,212,0.8)]',
                        !done && !failed && !selected && 'border-white/10 bg-white/5 text-white hover:border-cyan/40 hover:bg-cyan/5 active:scale-[0.98]',
                      )}
                    >
                      {entry.word}
                      {done && <Check className="h-4 w-4 text-emerald shrink-0" />}
                      {failed && <X className="h-4 w-4 text-coral shrink-0" />}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2.5">
                {rightColumn.map(translation => {
                  const done = matchedTranslations.has(translation)
                  const failed = wrong?.translation === translation
                  const selected = selectedTranslation === translation
                  return (
                    <button
                      key={translation}
                      ref={element => {
                        if (element) translationRefs.current.set(translation, element)
                        else translationRefs.current.delete(translation)
                      }}
                      onClick={() => pickTranslation(translation)}
                      disabled={done || wrong !== null}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-all duration-200',
                        done && 'border-emerald/50 bg-emerald/10 text-emerald-200 shadow-[0_0_20px_-8px_rgba(52,211,153,0.9)]',
                        failed && 'border-coral/60 bg-coral/10 text-red-100',
                        !done && !failed && selected && 'border-cyan/60 bg-cyan/10 text-cyan-100 shadow-[0_0_20px_-6px_rgba(6,182,212,0.8)]',
                        !done && !failed && !selected && 'border-white/10 bg-white/5 text-slate-200 hover:border-cyan/40 hover:bg-cyan/5 active:scale-[0.98]',
                      )}
                    >
                      {translation}
                      {done && <Check className="h-4 w-4 text-emerald shrink-0" />}
                      {failed && <X className="h-4 w-4 text-coral shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* Conectores: el acierto se dibuja solo y el fallo destella en rojo */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <style>{CONNECTOR_KEYFRAMES}</style>
                {connectors.map(line => {
                  const color = line.wrong ? '#fb7185' : '#34d399'
                  const pull = Math.min(Math.max(Math.abs(line.x2 - line.x1) * 0.45, 26), 70)
                  const path = `M ${line.x1} ${line.y1} C ${line.x1 + pull} ${line.y1}, ${line.x2 - pull} ${line.y2}, ${line.x2} ${line.y2}`
                  return (
                    <g key={line.id} style={{ animation: 'pair-pop 200ms ease-out both' }}>
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={line.wrong ? 3 : 8}
                        strokeLinecap="round"
                        opacity={line.wrong ? 0.22 : 0.14}
                      />
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={line.wrong ? 2.5 : 2}
                        strokeLinecap="round"
                        {...(line.wrong
                          ? { strokeDasharray: '7 7' }
                          : {
                              pathLength: 1,
                              strokeDasharray: 1,
                              strokeDashoffset: 1,
                              style: { animation: 'pair-draw 420ms ease forwards' },
                            })}
                      />
                      <circle cx={line.x1} cy={line.y1} r={4} fill={color} />
                      <circle cx={line.x2} cy={line.y2} r={4} fill={color} />
                    </g>
                  )
                })}
              </svg>
            </div>

            <button
              onClick={backToStudy}
              className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-cyan transition-colors"
            >
              <Eye className="h-3.5 w-3.5" /> Ver las palabras otra vez
            </button>
          </div>
        )}

        {/* Fase 3: completar frases de la escena con la palabra que encaja */}
        {!loading && !error && phase === 'complete' && gaps[gapIndex] && (
          <div className="w-full max-w-2xl">
            <header className="flex items-center justify-between gap-4 mb-2">
              <div>
                <p className="text-[10px] text-cyan uppercase tracking-[0.25em]">Antes de la conversación</p>
                <h2 className="text-xl font-bold text-white">Completa la frase</h2>
              </div>
              <span className="text-xs px-2 py-1 rounded border font-bold border-cyan/50 bg-cyan/10 text-cyan">
                Frase {gapIndex + 1} de {gaps.length}
              </span>
            </header>
            <p className="text-[12px] text-slate-400 mb-4">
              Elige la palabra que encaja en cada frase de la escena.
              {gapMistakes > 0 && <> · {gapMistakes} fallo{gapMistakes === 1 ? '' : 's'}</>}
            </p>

            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 mb-4">
              <p className="font-reading text-xl leading-relaxed text-white sm:text-2xl">
                {gaps[gapIndex].before}
                <span
                  className={cn(
                    'mx-1 inline-block min-w-20 border-b-2 px-2 text-center font-bold',
                    gapChoice ? 'border-emerald/60 text-emerald' : 'border-cyan/50 text-cyan/40',
                  )}
                >
                  {gapChoice ? gaps[gapIndex].word : '___'}
                </span>
                {gaps[gapIndex].after}
              </p>
              {gapChoice && (
                <p className="mt-3 text-[13px] italic text-slate-400">{gaps[gapIndex].translation}</p>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3 mb-5">
              {gaps[gapIndex].options.map(option => {
                const isCorrect = option === gaps[gapIndex].word
                const chosen = gapChoice === option
                return (
                  <button
                    key={option}
                    onClick={() => pickGapOption(option)}
                    disabled={gapChoice !== null}
                    className={cn(
                      'rounded-xl border px-3.5 py-3 text-sm font-bold transition-all duration-200',
                      gapChoice === null && 'border-white/10 bg-white/5 text-white hover:border-cyan/40 hover:bg-cyan/5 active:scale-[0.98]',
                      gapChoice !== null && isCorrect && 'border-emerald/50 bg-emerald/10 text-emerald-200 shadow-[0_0_20px_-8px_rgba(52,211,153,0.9)]',
                      gapChoice !== null && chosen && !isCorrect && 'border-coral/60 bg-coral/10 text-red-100',
                      gapChoice !== null && !chosen && !isCorrect && 'border-white/10 bg-white/5 text-slate-500',
                    )}
                  >
                    {option}
                  </button>
                )
              })}
            </div>

            {gapChoice !== null && (
              <button
                onClick={nextGap}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan text-black font-bold text-xs uppercase tracking-widest py-3 transition-colors hover:bg-cyan-400"
              >
                {gapIndex + 1 >= gaps.length ? 'Ver resumen' : 'Siguiente frase'} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Fase 4: resumen */}
        {!loading && !error && phase === 'summary' && (
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-8 text-center space-y-4">
            <p className="text-4xl">🏅</p>
            <h2 className="text-xl font-bold text-white">¡Actividades listas!</h2>
            <p className="text-sm text-slate-300">
              {words.length} pares emparejados{gaps.length > 0 && ` · ${gaps.length} frases completadas`}
              {mistakes + gapMistakes > 0 && ` · ${mistakes + gapMistakes} fallo${mistakes + gapMistakes === 1 ? '' : 's'}`}
            </p>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-full bg-cyan shadow-[0_0_10px_rgba(6,182,212,0.6)]" />
            </div>
            <p className="text-[12px] text-slate-400">{closingMessage(mistakes + gapMistakes, words.length)}</p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={onFinish}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white text-cyan-900 font-black text-sm uppercase tracking-wider py-3 transition-transform hover:scale-[1.02] active:scale-95"
              >
                Ir a la misión <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={retryMatching}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-[11px] font-mono uppercase tracking-widest text-slate-300 hover:border-white/30 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Repetir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
