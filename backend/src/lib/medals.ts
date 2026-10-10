/**
 * Catálogo de medallas: hitos permanentes que el alumno gana jugando.
 *
 * Es la fuente única (backend y frontend leen de aquí o de la API): cada
 * medalla tiene su id estable, nombre creativo, descripción e icono. Las
 * condiciones se evalúan en `modules/medals/service.ts`; una vez ganadas se
 * guardan en la tabla `medals` y no se pierden (racha, temporada…).
 */

export interface MedalDefinition {
  id: string
  name: string
  description: string
  /** Icono lógico; el frontend lo mapea a un icono de lucide. */
  icon: string
}

export const MEDALS: MedalDefinition[] = [
  // Por nivel completado (todas las misiones del nivel)
  { id: 'dios-a1', name: 'El Dios del A1', description: 'Completa todas las misiones de A1.', icon: 'crown' },
  { id: 'principe-basico', name: 'Príncipe del Básico', description: 'Completa todas las misiones de A2.', icon: 'gem' },
  { id: 'senor-intermedio', name: 'Señor del Intermedio', description: 'Completa todas las misiones de B1.', icon: 'shield' },
  { id: 'maestro-avanzado', name: 'Maestro del Avanzado', description: 'Completa todas las misiones de B2.', icon: 'swords' },
  { id: 'leyenda-c1', name: 'Leyenda del C1', description: 'Completa todas las misiones de C1.', icon: 'star' },

  // Por nivel de XP
  { id: 'nivel-10', name: 'Doble Dígito', description: 'Alcanza el nivel 10.', icon: 'trending-up' },
  { id: 'nivel-20', name: 'Veterano', description: 'Alcanza el nivel 20.', icon: 'medal' },
  { id: 'nivel-30', name: 'Élite', description: 'Alcanza el nivel 30.', icon: 'trophy' },
  { id: 'nivel-40', name: 'Titán', description: 'Alcanza el nivel 40.', icon: 'mountain' },
  { id: 'nivel-50', name: 'Inmortal', description: 'Alcanza el nivel 50.', icon: 'infinity' },

  // Misiones
  { id: 'primera-mision', name: 'Primer Paso', description: 'Completa tu primera misión.', icon: 'footprints' },
  { id: 'misiones-10', name: 'Rompemisiones', description: 'Completa 10 misiones.', icon: 'target' },
  { id: 'misiones-50', name: 'Sin Descanso', description: 'Completa 50 misiones.', icon: 'zap' },
  { id: 'misiones-100', name: 'Centurión', description: 'Completa 100 misiones.', icon: 'castle' },

  // Racha
  { id: 'racha-7', name: 'Semana Perfecta', description: 'Practica 7 días seguidos.', icon: 'flame' },
  { id: 'racha-30', name: 'Mes Imparable', description: 'Practica 30 días seguidos.', icon: 'rocket' },

  // Vocabulario y repaso
  { id: 'palabras-50', name: 'Coleccionista de Palabras', description: 'Guarda 50 palabras.', icon: 'book-marked' },
  { id: 'palabras-150', name: 'Léxico de Oro', description: 'Guarda 150 palabras.', icon: 'book-open' },
  { id: 'repasos-25', name: 'Memoria de Hierro', description: 'Completa 25 repasos de vocabulario.', icon: 'repeat' },

  // Varias
  { id: 'perfectas-5', name: 'Perfeccionista', description: 'Consigue 5 evaluaciones con 95 o más de comprensión.', icon: 'sparkles' },
  { id: 'nocturno', name: 'Noctámbulo', description: 'Completa una misión de madrugada (00:00-05:00).', icon: 'moon' },
  { id: 'madrugador', name: 'Madrugador', description: 'Completa una misión antes de las 07:00.', icon: 'sunrise' },
  { id: 'pase-completo', name: 'Dueño del Pase', description: 'Completa las 20 casillas de una temporada.', icon: 'award' },
  { id: 'comprador-5', name: 'De Compras', description: 'Compra 5 artículos en la tienda.', icon: 'shopping-bag' },
  { id: 'en-equipo', name: 'En Equipo', description: 'Únete a un grupo con tu clase.', icon: 'users' },
]

export const MEDAL_BY_ID = new Map(MEDALS.map(medal => [medal.id, medal]))
