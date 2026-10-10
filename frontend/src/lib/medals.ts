/**
 * Medallas en el frontend: mapa de iconos lógicos a iconos de lucide.
 *
 * El backend manda el catálogo con un `icon` semántico; aquí se traduce a un
 * icono concreto, con `Award` como respaldo si llega algo desconocido.
 */
import {
  Award,
  BookMarked,
  BookOpen,
  Castle,
  Crown,
  Flame,
  Footprints,
  Gem,
  Infinity as InfinityIcon,
  Medal,
  Moon,
  Mountain,
  Repeat,
  Rocket,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Sunrise,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

const MEDAL_ICONS: Record<string, LucideIcon> = {
  crown: Crown,
  gem: Gem,
  shield: Shield,
  swords: Swords,
  star: Star,
  'trending-up': TrendingUp,
  medal: Medal,
  trophy: Trophy,
  mountain: Mountain,
  infinity: InfinityIcon,
  footprints: Footprints,
  target: Target,
  zap: Zap,
  castle: Castle,
  flame: Flame,
  rocket: Rocket,
  'book-marked': BookMarked,
  'book-open': BookOpen,
  repeat: Repeat,
  sparkles: Sparkles,
  moon: Moon,
  sunrise: Sunrise,
  award: Award,
  'shopping-bag': ShoppingBag,
  users: Users,
}

export function medalIcon(name: string): LucideIcon {
  return MEDAL_ICONS[name] ?? Award
}

/** Medalla servida por la API (catálogo + estado del alumno). */
export interface StudentMedal {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
  earned_at: string | null
}

export interface StudentMedals {
  medals: StudentMedal[]
  earned: number
  total: number
}
