import { useEffect, useRef, useState } from 'react'

interface TypewriterMessageProps {
  text: string
  isActive: boolean
  /** Milisegundos base por letra; se añade un pequeño jitter para que no suene mecánico. */
  speed?: number
  /** Se llama cuando la última letra se ha escrito. */
  onComplete?: () => void
}

/**
 * Escribe un texto letra a letra.
 *
 * El ritmo es ligeramente irregular (como si alguien tecleara) y el cursor
 * hereda el color del texto, así que cada personaje puede tener el suyo.
 */
export function TypewriterMessage({
  text,
  isActive,
  speed = 28,
  onComplete,
}: TypewriterMessageProps) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    setDone(false)

    if (!isActive) {
      setDisplayed(text)
      setDone(true)
      return
    }

    setDisplayed('')
    let index = 0
    let timeout: ReturnType<typeof setTimeout>

    const typeNext = () => {
      if (index >= text.length) {
        setDone(true)
        onCompleteRef.current?.()
        return
      }
      index++
      setDisplayed(text.slice(0, index))
      timeout = setTimeout(typeNext, speed + Math.random() * 14)
    }

    typeNext()

    return () => clearTimeout(timeout)
  }, [text, isActive, speed])

  return (
    <>
      {displayed}
      {isActive && !done && (
        <span className="inline-block w-[3px] h-[1.05em] align-[-0.15em] ml-0.5 bg-current animate-pulse rounded-sm" />
      )}
    </>
  )
}
