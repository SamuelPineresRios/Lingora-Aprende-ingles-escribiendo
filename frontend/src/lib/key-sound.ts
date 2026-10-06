/**
 * Sonido de teclas para la cabecera de misión.
 *
 * Se sintetiza con Web Audio (sin archivos ni dependencias): un golpe corto de
 * ruido filtrado, con tono y volumen ligeramente aleatorios para que no suene
 * mecánico. Si el navegador no deja arrancar el audio (política de autoplay),
 * se sigue sin sonido en vez de fallar.
 */

let context: AudioContext | null = null

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null

  if (!context || context.state === 'closed') {
    try {
      context = new AudioContext()
    } catch {
      return null
    }
  }
  if (context.state === 'suspended') {
    void context.resume().catch(() => {})
  }
  return context
}

/** Un clic de tecla; se ignora en silencio si el audio no está disponible. */
export function playKeySound(): void {
  const ctx = ensureContext()
  if (!ctx || ctx.state !== 'running') return

  const duration = 0.016 + Math.random() * 0.012
  const samples = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // Ruido con caída exponencial: el "clac" seco de una tecla mecánica.
  for (let i = 0; i < samples; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples, 3)
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1700 + Math.random() * 1100
  filter.Q.value = 0.85

  const gain = ctx.createGain()
  gain.gain.value = 0.045 + Math.random() * 0.03

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}
