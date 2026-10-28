/**
 * Texto con palabras interactivas.
 *
 * Al pasar el cursor (o tocar, en móvil) sobre una palabra se muestra su
 * traducción y un botón para guardarla en el vocabulario. En las escenas se
 * pide `showTranslation={false}`: sin ficha, solo el botón de guardar. La
 * ficha la genera el backend y queda cacheada allí para todos; aquí se guarda
 * además en memoria durante la sesión, así que repetir una palabra es
 * instantáneo.
 *
 * El popover se monta en el body con posición fija: dentro de la escena hay
 * transformaciones (scale) que romperían un `fixed` normal.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { BookmarkPlus, Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { posLabel } from '@/lib/part-of-speech'
import { getCachedWord, setCachedWord, type WordCard } from '@/lib/word-cache'

/**
 * Separa palabras de signos, conservando todo (los grupos capturados).
 * `\p{L}` incluye tildes y eñes: sin eso, "Márquez" se partía en "M" + "rquez"
 * y esos fragmentos acababan en el vocabulario.
 */
const WORD_SPLIT = /([\p{L}][\p{L}'’-]*)/gu
/** Sin flag global: `test` con `g` es stateful y fallaría una de cada dos veces. */
const IS_WORD = /^[\p{L}][\p{L}'’-]*$/u

const POPOVER_WIDTH = 288
const MARGIN = 8

/** Coloca el popover encima de la palabra; si no cabe, debajo. */
function popoverStyle(rect: DOMRect): CSSProperties {
  const left = Math.min(
    Math.max(MARGIN, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
    window.innerWidth - POPOVER_WIDTH - MARGIN,
  )
  const fitsAbove = rect.top > 230
  return fitsAbove
    ? { left, bottom: window.innerHeight - rect.top + MARGIN, width: POPOVER_WIDTH }
    : { left, top: rect.bottom + MARGIN, width: POPOVER_WIDTH }
}

interface InteractiveWordsProps {
  text: string
  /** Frase completa donde va la palabra: le da contexto a la traducción. */
  context?: string
  className?: string
  /** En el Desafío se apaga: sin traducciones al pasar el cursor. */
  enabled?: boolean
  /** Las escenas no muestran la traducción: la palabra solo se puede guardar. */
  showTranslation?: boolean
}

export function InteractiveWords({ text, context, className, enabled = true, showTranslation = true }: InteractiveWordsProps) {
  const [active, setActive] = useState<{ word: string; rect: DOMRect } | null>(null)
  const [card, setCard] = useState<WordCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Descarta respuestas de palabras que ya no están en pantalla. */
  const requestId = useRef(0)

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setActive(null), 220)
  }
  useEffect(() => cancelClose, [])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  if (!enabled) return <span className={className}>{text}</span>

  const openFor = async (word: string, element: HTMLElement) => {
    cancelClose()
    const key = word.toLowerCase()
    setActive({ word, rect: element.getBoundingClientRect() })
    setError(null)

    const cached = getCachedWord(key)
    if (cached) {
      setCard(cached)
      setLoading(false)
      return
    }

    const id = ++requestId.current
    setCard(null)
    setLoading(true)
    try {
      const res = await fetch('/api/words/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: key, context: context ?? text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Error')
      setCachedWord(key, data.card)
      if (requestId.current === id) setCard(data.card)
    } catch {
      if (requestId.current === id) setError('No se pudo traducir la palabra.')
    } finally {
      if (requestId.current === id) setLoading(false)
    }
  }

  const save = async () => {
    const word = card?.word ?? active?.word
    if (!word || card?.saved || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, context: context ?? text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Error')
      setCachedWord(word.toLowerCase(), data.card)
      setCard(data.card)
    } catch {
      setError('No se pudo guardar la palabra.')
    } finally {
      setSaving(false)
    }
  }

  const parts = text.split(WORD_SPLIT)

  return (
    <span className={className}>
      {parts.map((part, index) =>
        IS_WORD.test(part) ? (
          <span
            key={index}
            role="button"
            tabIndex={0}
            className="cursor-help transition-colors hover:text-cyan hover:underline hover:decoration-dotted hover:decoration-cyan/70 hover:underline-offset-4 focus-visible:underline focus-visible:decoration-dotted focus-visible:decoration-cyan/70 focus-visible:underline-offset-4"
            onMouseEnter={event => openFor(part, event.currentTarget)}
            onMouseLeave={scheduleClose}
            onClick={event => openFor(part, event.currentTarget)}
            onFocus={event => openFor(part, event.currentTarget)}
          >
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}

      {active &&
        createPortal(
          <div
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            style={popoverStyle(active.rect)}
            className="fixed z-[200] rounded-xl border border-cyan/30 bg-slate-950/95 backdrop-blur-md p-3 shadow-[0_10px_40px_-10px_rgba(6,182,212,0.5)] font-body animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{active.word}</p>
                {showTranslation && card && (
                  <p className="text-[9px] uppercase tracking-widest text-slate-500">
                    {posLabel(card.part_of_speech, false)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setActive(null)}
                aria-label="Cerrar"
                className="text-slate-500 hover:text-white transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {loading && (
              <p className="flex items-center gap-2 text-xs text-slate-400 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Traduciendo…
              </p>
            )}

            {!loading && showTranslation && card && (
              <p className="text-base text-cyan-100">{card.translation}</p>
            )}

            {!loading && (showTranslation ? card : active) && (
              <button
                onClick={save}
                disabled={card?.saved || saving}
                className={cn(
                  'mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors',
                  card?.saved
                    ? 'border-emerald/40 bg-emerald/10 text-emerald cursor-default'
                    : 'border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20',
                )}
              >
                {card?.saved ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Guardada
                  </>
                ) : saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="h-3.5 w-3.5" /> Guardar palabra
                  </>
                )}
              </button>
            )}

            {!loading && error && <p className="text-xs text-coral">{error}</p>}
          </div>,
          document.body,
        )}
    </span>
  )
}
