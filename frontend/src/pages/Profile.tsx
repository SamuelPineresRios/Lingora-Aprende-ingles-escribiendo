import { useState, useEffect, type CSSProperties } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import { Camera, Edit2, Shield, Award, Brain, Target, CheckCircle2, TrendingUp, Coins } from 'lucide-react'
import { ResponsiveBackgroundSprites } from '@/components/ResponsiveBackgroundSprites'
import { FrameRing } from '@/components/FrameRing'
import { Canvas3DBackground } from '@/components/Canvas3DBackground'
import { ActivityHistory } from '@/components/ActivityHistory'
import { XpBar } from '@/components/XpBar'
import { useProgress } from '@/lib/hooks/useProgress'
import { useStoreView, useThemeAccent } from '@/lib/hooks/useStoreView'
import { useSeasonProgress } from '@/lib/hooks/useSeasonProgress'
import { readJson } from '@/lib/api'
import { resolveAvatar } from '@vox/shared'
import { studentAvatarUrl } from '@/lib/avatar'
import { activeFrame, badgeIcon, unlockedBadges } from '@/lib/season'
import { equippedItem } from '@/lib/store'

interface Mission { id:string; title:string; description:string|null; cefr_level:string; status:string }

/** Perfil de habilidades que calcula el backend desde las evaluaciones reales. */
interface StudentSkills {
  evaluated_responses: number
  grammar: number | null
  vocabulary: number | null
  comprehension: number | null
  writing: number | null
  speed: number | null
  top_structures: Array<{ structure: string; count: number }>
}

/**
 * Ejes del radar. `reading` no está porque la app sólo mide escritura: no se
 * inventa una nota de lectura.
 */
const SKILL_AXES = [
  { key: 'vocabulary', subject: 'Vocabulary' },
  { key: 'grammar', subject: 'Grammar' },
  { key: 'comprehension', subject: 'Comp.' },
  { key: 'writing', subject: 'Writing' },
  { key: 'speed', subject: 'Speed' },
] as const

/** Nota global -> letra y estado, para no inventar una calificación fija. */
function ratingFor(overall: number | null): string {
  if (overall === null) return '—'
  if (overall >= 90) return 'A+'
  if (overall >= 80) return 'A'
  if (overall >= 70) return 'B'
  if (overall >= 60) return 'C'
  if (overall >= 50) return 'D'
  return 'E'
}

function statusFor(overall: number | null): string {
  if (overall === null) return 'SIN DATOS'
  if (overall >= 80) return 'OPTIMAL'
  if (overall >= 60) return 'ESTABLE'
  return 'EN ENTRENAMIENTO'
}

export default function ProfilePage() {
  const { user, refetch } = useAuth()
  const { progress } = useProgress(user?.id)
  /** Pase de temporada compartido: marco activo, insignias y monedas. */
  const season = useSeasonProgress(user?.id)
  /** Tienda compartida: lo equipado (marco, título y tema) pisa lo del pase. */
  const shop = useStoreView(user?.id)
  /** Acento del tema equipado: tiñe barra de XP, gráfica y detalles del perfil. */
  const accent = useThemeAccent(user?.id)
  const [missions, setMissions] = useState<Mission[]>([])
  const [skills, setSkills] = useState<StudentSkills | null>(null)
  const [, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')

  // Marco: el equipado en la tienda o, si no, el mejor del pase.
  const shopFrame = equippedItem(shop, 'frame')
  const seasonFrame = activeFrame(season)
  const frameId = shopFrame?.id ?? seasonFrame?.id ?? null
  const frameColors = shopFrame?.colors ?? seasonFrame?.colors ?? null
  const avatar = studentAvatarUrl(resolveAvatar({ id: user?.id ?? 'letoura', avatar: user?.avatar ?? null }))
  const title = equippedItem(shop, 'title')
  const badges = unlockedBadges(season)
  /** Variables CSS del tema para los estados hover/focus del perfil. */
  const themeVars = accent
    ? ({ '--acento': accent, '--acento-50': `${accent}80`, '--acento-30': `${accent}4d` } as CSSProperties)
    : undefined

  const saveName = async () => {
    setIsEditing(false)
    if (editName.trim() === '' || editName.trim() === user?.full_name) return
    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: editName })
      })
      if (res.ok) {
        console.log('Name updated successfully')
        // Refetch user data to update the UI
        await refetch()
      } else {
        console.error('Error updating name')
      }
    } catch (e) { 
      console.error('Error updating name:', e) 
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    // Misiones (para el log y la tasa) y perfil de habilidades real.
    Promise.all([
      fetch('/api/missions').then(readJson),
      fetch(`/api/students/${user.id}/skills`).then(readJson),
    ])
      .then(([missionsData, skillsData]) => {
        setMissions(missionsData?.missions ?? [])
        setSkills(skillsData ?? null)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error loading profile data:', err)
        setLoading(false)
      })
  }, [user?.id])

  const completedMissions = missions.filter(m => m.status === 'completed')
  const completionRate = missions.length > 0 ? Math.round((completedMissions.length / missions.length) * 100) : 0

  // Sólo se pintan los ejes con datos: si aún no hay velocidad medida, no
  // aparece como un cero que no es real.
  const radarData = skills
    ? SKILL_AXES
        .filter(axis => typeof skills[axis.key] === 'number')
        // `fullMark` fija la escala en 0-100: sin él, recharts se ajusta al
        // valor máximo y una nota baja parecería alta.
        .map(axis => ({ subject: axis.subject, A: skills[axis.key] as number, fullMark: 100 }))
    : []

  const measured = skills
    ? SKILL_AXES.map(axis => skills[axis.key]).filter((value): value is number => typeof value === 'number')
    : []
  const overall = measured.length ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length) : null
  const hasData = Boolean(skills && skills.evaluated_responses > 0)

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <Canvas3DBackground className="opacity-60" />
      <ResponsiveBackgroundSprites />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen p-8 font-mono max-w-6xl mx-auto space-y-8 animate-fade-in pt-16">
      {/* Header / Agent ID Card */}
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
        
        {/* Profile Card */}
        <div className="relative group" style={themeVars}>
           <div
             className="absolute inset-0 bg-gradient-to-br from-cyan/20 via-transparent to-blue-500/20 blur-xl opacity-50 group-hover:opacity-100 transition-opacity"
             style={accent ? { backgroundImage: `linear-gradient(135deg, ${accent}33, transparent, ${accent}26)` } : undefined}
           />
           <div className="relative bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />
              
              <div className="relative mb-4">
                 {/* Con marco (tienda o pase), el anillo animado lo pinta FrameRing; sin él, el punteado */}
                 {frameId && frameColors ? (
                   <FrameRing frameId={frameId} colors={frameColors} size={128}>
                      <img src={avatar} alt="" className="h-full w-full" />
                      <Link
                        to="/avatar"
                        title="Personalizar avatar"
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                         <Camera className="w-6 h-6 text-white" />
                      </Link>
                   </FrameRing>
                 ) : (
                   <div className="w-32 h-32 rounded-full border-2 border-dashed border-cyan/30 p-1 transition-colors group-hover:border-cyan">
                      <div className="relative w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden">
                         <img src={avatar} alt="" className="h-full w-full" />
                         <Link
                        to="/avatar"
                        title="Personalizar avatar"
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                         <Camera className="w-6 h-6 text-white" />
                      </Link>
                      </div>
                   </div>
                 )}
                 <div
                   className="absolute bottom-0 right-0 bg-black rounded-full p-1 border border-cyan shadow-[0_0_10px_cyan]"
                   style={accent ? { borderColor: accent, boxShadow: `0 0 10px ${accent}` } : undefined}
                 >
                    <Shield className="w-4 h-4 text-cyan fill-cyan/20" style={accent ? { color: accent, fill: `${accent}33` } : undefined} />
                 </div>
              </div>

              {isEditing ? (
                  <div className="flex items-center gap-2 mb-1 w-full max-w-[200px]">
                      <input 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-black/50 border border-[color:var(--acento-50,rgba(6,182,212,0.5))] rounded px-2 py-1 text-center w-full focus:outline-none focus:shadow-[0_0_10px_var(--acento-30,rgba(6,182,212,0.3))]"
                        autoFocus
                        onBlur={saveName}
                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      />
                  </div>
              ) : (
                  <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2 group-hover:text-[color:var(--acento,#06b6d4)] transition-colors cursor-pointer" onClick={() => {
                    setEditName(user?.full_name || '')
                    setIsEditing(true)
                  }}>
                    {user?.full_name || 'Usuario'}
                    {title && (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest"
                        style={{ borderColor: accent ?? 'rgba(139,92,246,0.5)', color: accent ?? '#a78bfa' }}
                      >
                        {title.text}
                      </span>
                    )}
                    <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                  </h2>
              )}
              
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Level {user?.cefr_level || 'N/A'} Operative</p>

              <Link
                to="/season"
                title="Pase de temporada"
                className="flex items-center gap-3 mb-4 text-xs hover:opacity-80 transition-opacity"
              >
                <span className="flex items-center gap-1 text-amber">
                  <Coins className="h-3.5 w-3.5" /> {season?.coins ?? 0}
                </span>
                {badges.map(badge => {
                  const Icon = badgeIcon(badge.id)
                  return <Icon key={badge.id} className="h-4 w-4" style={{ color: accent ?? '#a78bfa' }} />
                })}
              </Link>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full p-4 bg-white/5 rounded-xl border border-white/5">
                 <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase">Missions</p>
                    <p className="text-lg font-bold text-white">{completedMissions.length}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase">Rate</p>
                    <p className="text-lg font-bold text-emerald-400">{completionRate}%</p>
                 </div>

              </div>
           </div>
        </div>

        {/* Skills Radar */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                 <Brain className="w-4 h-4 text-purple-400" />
                 Estadísticas
               </h3>
               <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">
                  {statusFor(overall)}
               </span>
            </div>

            {hasData ? (
              <>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }} />
                      <Radar
                        name="Skills"
                        dataKey="A"
                        stroke={accent ?? '#06b6d4'}
                        strokeWidth={2}
                        fill={accent ?? '#06b6d4'}
                        fillOpacity={0.2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                  Calculado con {skills?.evaluated_responses} respuesta(s) evaluada(s) · escala 0-100
                </p>
                <p className="text-[10px] text-slate-600 text-center mt-1">
                  Lectura: sin datos — las misiones miden escritura, no lectura.
                </p>
              </>
            ) : (
              <div className="h-[250px] flex flex-col items-center justify-center gap-2 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-widest">Sin métricas todavía</p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Completa una misión y sus notas de vocabulario, gramática, comprensión y velocidad aparecerán aquí.
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Progreso: nivel, XP y racha */}
      <section className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-cyan" style={accent ? { color: accent } : undefined} />
          Progreso
        </h3>
        <XpBar progress={progress} variant="full" />
      </section>

      {/* Historial de actividad: misiones por día, semana y mes */}
      {user?.id && <ActivityHistory studentId={user.id} />}

      {/* Story Mode + Missions + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Recent Activity */}
         <div className="lg:col-span-2 bg-black/20 border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-6 flex items-center gap-2">
               <Target className="w-4 h-4 text-emerald-400" />
               Registro de misiones
            </h3>
            
            <div className="space-y-4">
               {completedMissions.length === 0 ? (
                   <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl">
                      <p className="text-slate-500 text-xs uppercase">No completed operations logged.</p>
                   </div>
               ) : (
                   completedMissions.map((mission) => (
                       <div key={mission.id} className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-xl hover:border-emerald-500/30 transition-colors group">
                           <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                           </div>
                           <div className="flex-1">
                              <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{mission.title}</h4>
                              <p className="text-[10px] text-slate-500 uppercase">{mission.cefr_level} // Completed</p>
                           </div>
                           <div className="px-3 py-1 rounded bg-black/40 border border-white/10 text-[10px] text-slate-400 font-mono">
                              100%
                           </div>
                       </div>
                   ))
               )}
            </div>
         </div>

         {/* Stats Column */}
         <div className="space-y-6">


            <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 rounded-2xl p-6">
               <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                     <Award className="w-6 h-6 text-amber-500" />
                  </div>
                  <span className="text-[10px] text-amber-500 font-bold border border-amber-500/30 px-2 py-0.5 rounded">RATING</span>
               </div>
               <p className="text-3xl font-bold text-white mb-1">{ratingFor(overall)}</p>
               <p className="text-[10px] text-slate-400 uppercase leading-relaxed">
                  {overall === null
                    ? 'Completa una misión para calcular tu calificación.'
                    : `Media ${overall}/100 de tus ${skills?.evaluated_responses} respuestas evaluadas.`}
               </p>
            </div>



                  <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                     <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-emerald-300" />
                        <p className="text-[11px] uppercase tracking-wider text-slate-300 font-bold">Seguimiento de estructuras</p>
                     </div>
                  {skills && skills.top_structures.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {skills.top_structures.map(({ structure, count }) => (
                        <span
                          key={structure}
                          className="text-[10px] uppercase tracking-wide px-2 py-1 rounded border border-white/15 bg-white/5 text-slate-300"
                        >
                          {structure} x{count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Aún no hay estructuras detectadas: aparecerán con tus próximas evaluaciones.
                    </p>
                  )}
                  </div>
         </div>
      </div>
      </div>
    </div>
  )
}


