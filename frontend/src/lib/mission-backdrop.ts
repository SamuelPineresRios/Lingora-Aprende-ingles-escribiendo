/**
 * Fondo de una misión.
 *
 * Cuando la misión ya tiene una dirección de arte generada, se usa tal cual.
 * Cuando no (escena sin generar o generada antes de la función), este
 * diccionario deriva un fondo del título y el contexto: determinista, sin
 * llamadas y con el mismo contrato.
 */
import type { BackdropKind, BackdropStyle, MissionBackdrop } from '@vox/shared'

/** Sin tildes ni mayúsculas: "farmacia" encuentra "Farmacia" y "médico" también. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Hash estable de texto a entero sin signo (para elegir variante y variar la escena). */
export function hashText(text: string): number {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

interface BackdropRule {
  test: RegExp
  kind: BackdropKind
  style: BackdropStyle
  palettes: string[][]
}

/**
 * En orden: gana la primera regla. Las genéricas van al final para no robar
 * escenas específicas (una "tienda de ropa" es shop aunque diga "ropa").
 */
const RULES: BackdropRule[] = [
  {
    test: /farmacia|hospital|medic|clinic|dentista|urgencias/,
    kind: 'health',
    style: 'diorama',
    palettes: [
      ['#0f2b2b', '#1d4b4b', '#5eead4'],
      ['#12222e', '#1e3a4a', '#7dd3fc'],
    ],
  },
  {
    test: /gimnasio|yoga|deporte|entrenar/,
    kind: 'gym',
    style: 'flat',
    palettes: [
      ['#1a1230', '#2b1d4d', '#f472b6'],
      ['#0e1a2b', '#1c2f4a', '#38bdf8'],
    ],
  },
  {
    test: /universidad|instituto|bibliotec|colegio|escuela|clase|curso|examen/,
    kind: 'campus',
    style: 'diorama',
    palettes: [
      ['#1b2436', '#2d3c56', '#fbbf24'],
      ['#101f2b', '#1e3a4a', '#86efac'],
    ],
  },
  {
    test: /restaurante|cafe|cafeter|bar|pub|comida|cena|almuerzo/,
    kind: 'restaurant',
    style: 'diorama',
    palettes: [
      ['#241420', '#3d2233', '#fb7185'],
      ['#1f1a12', '#3a2d1c', '#fbbf24'],
    ],
  },
  {
    test: /hotel|hostal|alojamiento|recepc/,
    kind: 'hotel',
    style: 'diorama',
    palettes: [
      ['#1a1a2e', '#2a2a4a', '#f0abfc'],
      ['#101a26', '#1d2f42', '#fcd34d'],
    ],
  },
  {
    test: /parque|jardin|playa|paseo|aire libre/,
    kind: 'park',
    style: 'diorama',
    palettes: [
      ['#0f2418', '#1d4029', '#a3e635'],
      ['#0d2233', '#17475a', '#5eead4'],
    ],
  },
  {
    test: /casa|apartament|airbnb|piso|hogar|domicilio|sala/,
    kind: 'home',
    style: 'diorama',
    palettes: [
      ['#241a14', '#3d2b1f', '#fb923c'],
      ['#1a1f2e', '#2a3350', '#f0abfc'],
    ],
  },
  {
    test: /tienda|supermercado|mercado|librer|ropa|zapater|compras/,
    kind: 'shop',
    style: 'diorama',
    palettes: [
      ['#1e1a2e', '#33294d', '#f472b6'],
      ['#0f1f2b', '#1d3a4a', '#38bdf8'],
    ],
  },
  {
    test: /aeropuerto|avion|vuelo|estacion|autobus|tren|taxi|metro|anden/,
    kind: 'transport',
    style: 'flat',
    palettes: [
      ['#101a2b', '#1e2f4a', '#38bdf8'],
      ['#151b26', '#242f42', '#facc15'],
    ],
  },
  {
    test: /banco|cambio de divisas|oficina de cambio|atencion al cliente|suscripcion|factura|seguro|servicio/,
    kind: 'services',
    style: 'blueprint',
    palettes: [
      ['#0b1f33', '#123a5c', '#22d3ee'],
      ['#101a2e', '#1c2b4a', '#818cf8'],
    ],
  },
  {
    test: /oficina|despacho|reunion|empresa|trabajo|jefe|entrevista|contrato|conferencia|corporativ|negoci/,
    kind: 'office',
    style: 'blueprint',
    palettes: [
      ['#0b1f33', '#123a5c', '#22d3ee'],
      ['#141a2e', '#232c4a', '#a78bfa'],
    ],
  },
  {
    test: /calle|plaza|ciudad|centro|barrio|esquina|direccion/,
    kind: 'street',
    style: 'flat',
    palettes: [
      ['#121826', '#22304a', '#fbbf24'],
      ['#111a2b', '#1e2f4a', '#f472b6'],
    ],
  },
]

const GENERIC: BackdropRule = {
  test: /.*/,
  kind: 'generic',
  style: 'diorama',
  palettes: [['#101826', '#1c2b45', '#38bdf8']],
}

/** Fondo derivado del texto de la misión (título + contexto). */
export function fallbackBackdrop(text: string): MissionBackdrop {
  const plain = normalize(text)
  const rule = RULES.find(candidate => candidate.test.test(plain)) ?? GENERIC

  const night = /\b(noche|nocturn\w*|madrugada)\b/.test(plain)
  const sunset = /\b(atardecer|atardec\w*|tarde|puesta de sol)\b/.test(plain)
  const light = night ? 'night' : sunset ? 'sunset' : 'day'

  const palette = rule.palettes[hashText(plain) % rule.palettes.length]
  return { kind: rule.kind, style: rule.style, light, palette }
}

/** El fondo de la misión: el generado si existe, si no el de respaldo. */
export function resolveBackdrop(
  backdrop: MissionBackdrop | null | undefined,
  text: string,
): MissionBackdrop {
  return backdrop ?? fallbackBackdrop(text)
}
