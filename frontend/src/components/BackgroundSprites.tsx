import { useEffect, useState } from 'react'
import { baseAvatar } from '@vox/shared'
import { preloadAvatar, studentAvatarUrl } from '@/lib/avatar'

const PHRASES = [
  "Can I help you today?",
  "I'd like to book a flight.",
  "My computer won't start.",
  "Where is the train station?",
  "Table for two, please.",
  "Nice to meet you!",
  "Is there a discount?",
  "I have a reservation.",
  "Just looking, thanks.",
  "How much is this?",
  "Excuse me, officer.",
]

const LANES = [18, 38, 58, 78] // Percentages from top

/**
 * Avatares decorativos: el mismo generador voxel-art que el perfil y la
 * personalización, con piezas fijas por seed para que no cambie el look.
 */
const AVATAR_SEEDS = [
  'lingora-npc-aurora',
  'lingora-npc-bruno',
  'lingora-npc-celeste',
  'lingora-npc-dante',
  'lingora-npc-elena',
  'lingora-npc-fabio',
  'lingora-npc-gala',
  'lingora-npc-hugo',
] as const

const AVATAR_URLS = AVATAR_SEEDS.map(seed => studentAvatarUrl(baseAvatar(seed)))

interface Sprite {
  id: number
  x: number // percent
  laneIndex: number
  avatarIndex: number
  phrase: string
  direction: 'left' | 'right'
  speed: number
  opacity: number
}

export function BackgroundSprites() {
  const [sprites, setSprites] = useState<Sprite[]>([])

  useEffect(() => {
    AVATAR_URLS.forEach(preloadAvatar)

    // Helper function to create a sprite
    const createRandomSprite = (id: number): Sprite => {
      const isRight = Math.random() > 0.5
      return {
        id,
        x: Math.random() * 100,
        laneIndex: Math.floor(Math.random() * LANES.length), // Assign to a specific lane
        avatarIndex: Math.floor(Math.random() * AVATAR_URLS.length),
        phrase: PHRASES[Math.floor(Math.random() * PHRASES.length)],
        direction: isRight ? 'right' : 'left',
        speed: 0.04 + Math.random() * 0.06,
        opacity: 0.7 + Math.random() * 0.3
      }
    }

    // Initialize 
    setSprites(Array.from({ length: 5 }).map((_, i) => createRandomSprite(i)))

    const interval = setInterval(() => {
      setSprites(current => 
        current.map(sprite => {
          const newX = sprite.x + (sprite.direction === 'right' ? sprite.speed : -sprite.speed)
          let updatedSprite = { ...sprite, x: newX }

          if (newX > 115 || newX < -15) {
            const isRight = Math.random() > 0.5
            const nextAvatar = (sprite.avatarIndex + 1 + Math.floor(Math.random() * (AVATAR_URLS.length - 1))) % AVATAR_URLS.length
            updatedSprite = {
              ...sprite,
              x: isRight ? -15 : 115,
              laneIndex: Math.floor(Math.random() * LANES.length), // Pick new lane
              avatarIndex: nextAvatar,
              direction: isRight ? 'right' : 'left',
              phrase: PHRASES[Math.floor(Math.random() * PHRASES.length)],
              speed: 0.04 + Math.random() * 0.06
            }
          }
          return updatedSprite
        })
      )
    }, 50)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Draw "Paths" (Lanes) */}
      {LANES.map((top, i) => (
        <div 
          key={i} 
          className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-cyan/10 to-transparent" 
          style={{ top: `${top + 14}%` }} // Offset to be under feet
        />
      ))}

      {sprites.map(sprite => (
        <div 
          key={sprite.id}
          className="absolute transition-transform will-change-transform ease-linear"
          style={{ 
            left: `${sprite.x}%`, 
            top: `${LANES[sprite.laneIndex]}%`,
            opacity: sprite.opacity,
            zIndex: LANES[sprite.laneIndex], // Lower lanes overlap higher ones correctly
            transitionDuration: '50ms',
            transform: 'translateX(-50%)'
          }}
        >
          <div className="relative group flex flex-col items-center">
            {/* Speech Bubble */}
            <div className={`
              mb-1 px-3 py-2 bg-slate-900/90 backdrop-blur-sm border border-cyan/30 
              text-[10px] text-cyan-200 font-mono rounded-lg whitespace-nowrap
              relative shadow-[0_0_15px_rgba(6,182,212,0.2)]
              transition-opacity duration-300
              ${sprite.x > 90 || sprite.x < 10 ? 'opacity-0' : 'opacity-100'}
            `}>
              {sprite.phrase}
              {/* Bubble Tail */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/90 border-r border-b border-cyan/30 rotate-45"></div>
            </div>

            {/* Avatar voxel del mismo estilo que el perfil */}
            <div className={`transform transition-transform ${sprite.direction === 'left' ? 'scale-x-[-1]' : ''}`}>
              <img
                src={AVATAR_URLS[sprite.avatarIndex]}
                alt=""
                className="h-24 w-24 object-contain drop-shadow-[0_10px_14px_rgba(2,6,23,0.55)] animate-[sprite-walk_1.4s_ease-in-out_infinite] motion-reduce:animate-none"
                style={{ transformOrigin: '50% 100%' }}
              />
            </div>

            {/* Shadow */}
            <div className="w-10 h-1.5 bg-black/40 blur-sm rounded-full -mt-2" />

            {/* Inline Styles for Custom Walk Animations */}
            <style>{`
              @keyframes sprite-walk {
                0%, 100% { transform: translateY(0) rotate(-2.5deg); }
                25% { transform: translateY(-2px) rotate(0deg); }
                50% { transform: translateY(-4px) rotate(2.5deg); }
                75% { transform: translateY(-2px) rotate(0deg); }
              }
            `}</style>
          </div>
        </div>
      ))}
    </div>
  )
}
