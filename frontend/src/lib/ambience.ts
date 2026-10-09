/**
 * Ambiente sonoro de las escenas, sintetizado con Web Audio.
 *
 * Sin archivos ni servicios: cada tipo de escenario (oficina, cafetería,
 * calle…) tiene una receta de ruido filtrado con un latido lento y acentos
 * suaves de vez en cuando. El volumen es bajo y con fundidos para no competir
 * con la voz. Los navegadores exigen un gesto para arrancar el audio, así que
 * si el contexto queda suspendido se reanuda al primer clic o tecla; la
 * pestaña oculta lo suspende para no sonar de fondo.
 */
import { useEffect } from 'react'
import type { BackdropKind } from '@vox/shared'

/**
 * Preferencia del alumno, guardada fuera del ciclo de React para que escena a
 * escena (y en futuras pantallas) suene igual hasta que la cambie.
 */
const PREFERENCE_KEY = 'lingora:ambience'

export function ambienceEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PREFERENCE_KEY) !== 'off'
}

export function setAmbienceEnabled(enabled: boolean): void {
  window.localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off')
}

type Accent = 'click' | 'clink' | 'chirp' | 'swish'

interface Recipe {
  /** Filtro del colchón de ruido. */
  lowpass: number
  q: number
  /** Latido lento del volumen, para que no sea un soplido plano. */
  breathRate: number
  breathDepth: number
  gain: number
  accent?: Accent
  /** Rango del intervalo entre acentos, en milisegundos. */
  accentEvery?: [number, number]
}

const RECIPES: Record<BackdropKind, Recipe> = {
  office: { lowpass: 480, q: 0.7, breathRate: 0.07, breathDepth: 0.2, gain: 0.085, accent: 'click', accentEvery: [7000, 15000] },
  services: { lowpass: 500, q: 0.7, breathRate: 0.08, breathDepth: 0.22, gain: 0.08, accent: 'click', accentEvery: [8000, 16000] },
  health: { lowpass: 420, q: 0.6, breathRate: 0.06, breathDepth: 0.18, gain: 0.075, accent: 'click', accentEvery: [9000, 18000] },
  campus: { lowpass: 520, q: 0.7, breathRate: 0.09, breathDepth: 0.25, gain: 0.09, accent: 'chirp', accentEvery: [6000, 14000] },
  hotel: { lowpass: 400, q: 0.6, breathRate: 0.06, breathDepth: 0.18, gain: 0.075, accent: 'click', accentEvery: [9000, 17000] },
  restaurant: { lowpass: 1100, q: 0.8, breathRate: 0.13, breathDepth: 0.35, gain: 0.11, accent: 'clink', accentEvery: [5000, 12000] },
  shop: { lowpass: 950, q: 0.8, breathRate: 0.12, breathDepth: 0.3, gain: 0.1, accent: 'clink', accentEvery: [6000, 13000] },
  street: { lowpass: 300, q: 0.5, breathRate: 0.05, breathDepth: 0.5, gain: 0.12, accent: 'swish', accentEvery: [8000, 16000] },
  transport: { lowpass: 260, q: 0.5, breathRate: 0.04, breathDepth: 0.55, gain: 0.13, accent: 'swish', accentEvery: [7000, 15000] },
  park: { lowpass: 340, q: 0.6, breathRate: 0.05, breathDepth: 0.4, gain: 0.1, accent: 'chirp', accentEvery: [4000, 10000] },
  home: { lowpass: 380, q: 0.6, breathRate: 0.06, breathDepth: 0.15, gain: 0.07, accent: 'click', accentEvery: [12000, 22000] },
  gym: { lowpass: 600, q: 0.8, breathRate: 0.11, breathDepth: 0.3, gain: 0.1, accent: 'click', accentEvery: [5000, 11000] },
  generic: { lowpass: 450, q: 0.7, breathRate: 0.06, breathDepth: 0.2, gain: 0.08 },
}

/** Ruido marrón en bucle: la base cálida de todas las recetas. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let index = 0; index < data.length; index++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[index] = last * 3.5
  }
  return buffer
}

/** Acento puntual, corto y suave, para que la escena no sea un soplido. */
function playAccent(context: AudioContext, output: AudioNode, accent: Accent): void {
  const now = context.currentTime
  const level = context.createGain()
  level.connect(output)

  if (accent === 'swish') {
    const source = context.createBufferSource()
    source.buffer = noiseBuffer(context)
    const band = context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 550
    band.Q.value = 0.6
    level.gain.setValueAtTime(0, now)
    level.gain.linearRampToValueAtTime(0.02, now + 0.18)
    level.gain.linearRampToValueAtTime(0, now + 0.7)
    source.connect(band).connect(level)
    source.start(now)
    source.stop(now + 0.75)
    return
  }

  const oscillator = context.createOscillator()
  oscillator.connect(level)

  if (accent === 'click') {
    oscillator.type = 'triangle'
    oscillator.frequency.value = 900 + Math.random() * 500
    level.gain.setValueAtTime(0.018, now)
    level.gain.exponentialRampToValueAtTime(0.0005, now + 0.05)
    oscillator.start(now)
    oscillator.stop(now + 0.06)
    return
  }

  if (accent === 'clink') {
    oscillator.type = 'sine'
    oscillator.frequency.value = 1800 + Math.random() * 900
    level.gain.setValueAtTime(0.022, now)
    level.gain.exponentialRampToValueAtTime(0.0005, now + 0.09)
    oscillator.start(now)
    oscillator.stop(now + 0.1)
    return
  }

  // Chirp: dos silbidos cortos de pájaro.
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(2200, now)
  oscillator.frequency.linearRampToValueAtTime(3000, now + 0.12)
  level.gain.setValueAtTime(0.02, now)
  level.gain.exponentialRampToValueAtTime(0.0005, now + 0.16)
  oscillator.start(now)
  oscillator.stop(now + 0.17)
}

/**
 * Arranca el ambiente de un escenario y devuelve cómo pararlo (fundido y
 * cierre del contexto incluidos).
 */
function startAmbience(kind: BackdropKind): () => void {
  const recipe = RECIPES[kind] ?? RECIPES.generic
  const context = new AudioContext()

  const master = context.createGain()
  master.gain.setValueAtTime(0, context.currentTime)
  master.gain.linearRampToValueAtTime(recipe.gain, context.currentTime + 1.6)
  master.connect(context.destination)

  const source = context.createBufferSource()
  source.buffer = noiseBuffer(context)
  source.loop = true

  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = recipe.lowpass
  filter.Q.value = recipe.q

  source.connect(filter).connect(master)
  source.start()

  // Latido lento del colchón: el volumen respira en vez de quedarse plano.
  const lfo = context.createOscillator()
  lfo.frequency.value = recipe.breathRate
  const lfoDepth = context.createGain()
  lfoDepth.gain.value = recipe.gain * recipe.breathDepth
  lfo.connect(lfoDepth).connect(master.gain)
  lfo.start()

  let accentTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleAccent = () => {
    const [min, max] = recipe.accentEvery ?? [9000, 18000]
    accentTimer = setTimeout(() => {
      if (recipe.accent) playAccent(context, master, recipe.accent)
      scheduleAccent()
    }, min + Math.random() * (max - min))
  }
  if (recipe.accent) scheduleAccent()

  // Sin gesto del usuario el contexto nace suspendido: se reanuda al primero.
  const resume = () => {
    if (context.state === 'suspended') void context.resume()
  }
  window.addEventListener('pointerdown', resume)
  window.addEventListener('keydown', resume)
  resume()

  // Pestaña oculta: se calla y se reanuda al volver.
  const onVisibility = () => {
    if (document.hidden) void context.suspend()
    else if (context.state === 'suspended') void context.resume()
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    if (accentTimer) clearTimeout(accentTimer)
    window.removeEventListener('pointerdown', resume)
    window.removeEventListener('keydown', resume)
    document.removeEventListener('visibilitychange', onVisibility)
    master.gain.cancelScheduledValues(context.currentTime)
    master.gain.linearRampToValueAtTime(0, context.currentTime + 0.8)
    setTimeout(() => void context.close(), 900)
  }
}

/** Ambiente del escenario mientras la pantalla esté montada y activado. */
export function useAmbience(kind: BackdropKind | undefined, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !kind || typeof window === 'undefined' || !('AudioContext' in window)) return
    return startAmbience(kind)
  }, [kind, enabled])
}
