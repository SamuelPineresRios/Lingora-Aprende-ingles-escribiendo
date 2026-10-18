/**
 * Rutas por objetivo: itinerarios curados sobre misiones que ya existen.
 *
 * Cada ruta agrupa misiones de varios niveles alrededor de una meta real
 * (viajar, trabajo, vida diaria, social, reclamaciones). El alumno ve la
 * rebanada de su nivel: así el progreso siempre es alcanzable y la ruta
 * crece con él. Añadir una ruta es añadir su entrada y sus misiones.
 */
export interface LearningPath {
  id: string
  label: string
  description: string
  /** Nombre del icono lucide que pinta la interfaz. */
  icon: string
  /** Misiones en orden de dificultad (ids del catálogo). */
  missions: string[]
}

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'ruta-viajes',
    label: 'Viajar',
    description: 'Del aeropuerto al hotel: moverte por el mundo sin quedarte en blanco.',
    icon: 'plane',
    missions: [
      'm-001', 'm-008', 'm-084', 'm-086', 'm-091', 'm-097',
      'm-016', 'm-103', 'm-104', 'm-111', 'm-114', 'm-123',
      'm-032', 'm-042', 'm-130',
      'm-053',
      'm-066',
    ],
  },
  {
    id: 'ruta-diaria',
    label: 'Vida diaria',
    description: 'Café, compras, médico y vecinos: el inglés que usas cada semana.',
    icon: 'coffee',
    missions: [
      'm-002', 'm-005', 'm-010', 'm-011', 'm-077', 'm-079', 'm-082', 'm-087', 'm-093', 'm-100',
      'm-101', 'm-110', 'm-118', 'm-121',
      'm-131', 'm-134', 'm-148',
      'm-060',
      'm-062',
    ],
  },
  {
    id: 'ruta-social',
    label: 'Conocer gente',
    description: 'Presentarte, quedar y charlar: soltarte en cualquier mesa.',
    icon: 'users',
    missions: [
      'm-003', 'm-004', 'm-083', 'm-085', 'm-089', 'm-092', 'm-098',
      'm-020', 'm-106', 'm-112', 'm-122',
      'm-035', 'm-132', 'm-136', 'm-142',
      'm-050',
      'm-064', 'm-071',
    ],
  },
  {
    id: 'ruta-trabajo',
    label: 'Trabajo y entrevistas',
    description: 'Del primer día a la negociación: inglés para tu carrera.',
    icon: 'briefcase',
    missions: [
      'm-027', 'm-117',
      'm-033', 'm-040', 'm-128', 'm-141', 'm-143', 'm-145',
      'm-057', 'm-058',
      'm-061', 'm-068', 'm-073',
    ],
  },
  {
    id: 'ruta-reclamaciones',
    label: 'Reclamar y resolver',
    description: 'Devoluciones, facturas y quejas: hacerte valer en inglés.',
    icon: 'megaphone',
    missions: [
      'm-021', 'm-107',
      'm-037', 'm-043', 'm-045', 'm-129', 'm-133', 'm-138', 'm-146', 'm-150',
      'm-052', 'm-054', 'm-055',
      'm-065', 'm-070', 'm-075',
    ],
  },
]
