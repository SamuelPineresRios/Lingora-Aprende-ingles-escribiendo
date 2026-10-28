/**
 * Lluvia de monedas de la tienda.
 *
 * `ambient` es la cascada de fondo (lenta, tenue y con algunas desenfocadas
 * para dar profundidad); `burst` es la ráfaga puntual que cae al comprar.
 * Las posiciones son fijas para que la animación no baile entre renders.
 */
import { Coins } from 'lucide-react'
import { cn } from '@/lib/utils'

type Coin = { left: number; delay: number; duration: number; size: number; opacity: number; blur?: boolean }

const AMBIENT: Coin[] = [
  { left: 3, delay: 0, duration: 11, size: 12, opacity: 0.16, blur: true },
  { left: 9, delay: 3.2, duration: 9, size: 16, opacity: 0.2 },
  { left: 15, delay: 6.4, duration: 13, size: 10, opacity: 0.12, blur: true },
  { left: 21, delay: 1.6, duration: 10, size: 18, opacity: 0.22 },
  { left: 28, delay: 8, duration: 12, size: 12, opacity: 0.14, blur: true },
  { left: 34, delay: 4.8, duration: 9.5, size: 15, opacity: 0.18 },
  { left: 41, delay: 0.8, duration: 14, size: 11, opacity: 0.12, blur: true },
  { left: 47, delay: 7.2, duration: 10.5, size: 17, opacity: 0.2 },
  { left: 54, delay: 2.4, duration: 12.5, size: 12, opacity: 0.15, blur: true },
  { left: 60, delay: 5.6, duration: 9, size: 16, opacity: 0.18 },
  { left: 67, delay: 1.2, duration: 13.5, size: 10, opacity: 0.12, blur: true },
  { left: 73, delay: 9, duration: 10, size: 19, opacity: 0.22 },
  { left: 80, delay: 3.8, duration: 12, size: 13, opacity: 0.15, blur: true },
  { left: 86, delay: 6.8, duration: 9.5, size: 15, opacity: 0.18 },
  { left: 92, delay: 0.4, duration: 13, size: 11, opacity: 0.13, blur: true },
  { left: 97, delay: 4.4, duration: 11, size: 17, opacity: 0.2 },
]

const BURST: Coin[] = [
  { left: 2, delay: 0, duration: 1.1, size: 20, opacity: 0.7 },
  { left: 8, delay: 0.12, duration: 0.95, size: 28, opacity: 0.85 },
  { left: 14, delay: 0.28, duration: 1.25, size: 18, opacity: 0.6 },
  { left: 20, delay: 0.05, duration: 1.05, size: 24, opacity: 0.75 },
  { left: 27, delay: 0.34, duration: 1.2, size: 20, opacity: 0.65 },
  { left: 33, delay: 0.16, duration: 0.9, size: 30, opacity: 0.9 },
  { left: 39, delay: 0.42, duration: 1.3, size: 18, opacity: 0.6 },
  { left: 45, delay: 0.08, duration: 1, size: 26, opacity: 0.8 },
  { left: 51, delay: 0.3, duration: 1.15, size: 22, opacity: 0.7 },
  { left: 57, delay: 0.02, duration: 0.95, size: 30, opacity: 0.9 },
  { left: 63, delay: 0.38, duration: 1.25, size: 18, opacity: 0.6 },
  { left: 69, delay: 0.2, duration: 1.05, size: 25, opacity: 0.78 },
  { left: 75, delay: 0.48, duration: 1.35, size: 17, opacity: 0.55 },
  { left: 81, delay: 0.1, duration: 0.92, size: 29, opacity: 0.88 },
  { left: 87, delay: 0.26, duration: 1.18, size: 21, opacity: 0.68 },
  { left: 92, delay: 0.06, duration: 1.02, size: 26, opacity: 0.8 },
  { left: 96, delay: 0.36, duration: 1.28, size: 19, opacity: 0.62 },
  { left: 46, delay: 0.55, duration: 1.4, size: 22, opacity: 0.6 },
]

export function CoinRain({ variant = 'ambient' }: { variant?: 'ambient' | 'burst' }) {
  const coins = variant === 'burst' ? BURST : AMBIENT
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', variant === 'burst' && 'z-30')}
    >
      {coins.map((coin, i) => (
        <Coins
          key={i}
          className={cn('absolute top-0 text-amber', variant === 'burst' ? 'coin-fall coin-fall-burst' : 'coin-fall')}
          style={{
            left: `${coin.left}%`,
            width: coin.size,
            height: coin.size,
            opacity: coin.opacity,
            animationDelay: `${coin.delay}s`,
            animationDuration: `${coin.duration}s`,
            filter: coin.blur ? 'blur(2px)' : undefined,
          }}
        />
      ))}
    </div>
  )
}
