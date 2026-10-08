import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { getCefrLabel } from '@vox/shared'
import { cn } from '@/lib/utils'
import { MissionSimulationAside } from '@/components/MissionSimulationAside'
import { DailyQuests } from '@/components/QuestBoard'
import { StreakBanner } from '@/components/StreakBanner'
import { ReviewSession } from '@/components/ReviewSession'
import { ResponsiveBackgroundSprites } from '@/components/ResponsiveBackgroundSprites'
import { MissionBackdrop } from '@/components/MissionBackdrop'
import { resolveBackdrop } from '@/lib/mission-backdrop'
import { prewarmIntroduction } from '@/lib/mission-content'
import { readJson } from '@/lib/api'
import type { MissionBackdrop as MissionBackdropSpec } from '@vox/shared'

interface Mission { id:string; title:string; description:string|null; scene_context?:string|null; cefr_level:string; base_duration_seconds:number; status:string; backdrop?:MissionBackdropSpec|null }
const LEVEL_COLORS: Record<string,string> = { A1:'text-emerald border-emerald/40', A2:'text-cyan border-cyan/40', B1:'text-amber border-amber/40', B2:'text-violet border-violet/40', C1:'text-coral border-coral/40' }
const LEVEL_BG: Record<string,string> = { A1:'bg-emerald/10', A2:'bg-cyan/10', B1:'bg-amber/10', B2:'bg-violet/10', C1:'bg-coral/10' }
const STATUS = { not_started:{label:'',color:''}, in_progress:{label:'IN PROGRESS',color:'text-amber animate-pulse'}, completed:{label:'COMPLETED',color:'text-emerald'}, paused:{label:'RETRY',color:'text-slate-light'} }

export default function MissionsPage() {
  const { user, logout } = useAuth()
  const [missions, setMissions] = useState<Mission[]>([])
  const [cefrLevel, setCefrLevel] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [, setError] = useState<string|null>(null)
  const [filter, setFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(0)
  
  useEffect(() => { 
    if (!user?.id) {
      setLoading(true)
      return
    }
    
    setLoading(true)
    
    const timeoutId = setTimeout(() => {
      setError('Timeout loading missions')
      setLoading(false)
    }, 5000)
    
    fetch('/api/missions')
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return readJson(r)
      })
      .then(d=>{ 
        console.log('[Missions] Loaded:', d?.missions?.length || 0, 'missions for level:', d?.cefr_level)
        setMissions(d?.missions??[]); 
        setCefrLevel(d?.cefr_level); 
        setFilter(d?.cefr_level ?? 'A1'); // Set filter to current level by default
        setLoading(false);
        setError(null)
      })
      .catch(e=>{ 
        console.error('[Missions] Error:', e); 
        setError(`Failed to load missions: ${e.message}`);
        setLoading(false)
      })
      .finally(() => clearTimeout(timeoutId))
  }, [user?.id])
  const filtered = filter==='all' ? missions : missions.filter(m=>m.cefr_level===filter)
  
  // Pagination logic
  const ITEMS_PER_PAGE = 6
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const startIdx = currentPage * ITEMS_PER_PAGE
  const endIdx = startIdx + ITEMS_PER_PAGE
  const paginatedMissions = filtered.slice(startIdx, endIdx)
  const canGoBack = currentPage > 0
  const canGoNext = currentPage < totalPages - 1
  
  const handleNextPage = () => {
    if (canGoNext) {
      setCurrentPage(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  
  const handlePrevPage = () => {
    if (canGoBack) {
      setCurrentPage(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  
  // Precarga la escena de las tarjetas visibles: en móvil no hay hover y, con
  // la respuesta en memoria, abrir cualquiera de ellas no espera nada.
  useEffect(() => {
    const list = filter === 'all' ? missions : missions.filter(mission => mission.cefr_level === filter)
    const start = currentPage * 6
    for (const mission of list.slice(start, start + 6)) prewarmIntroduction(mission.id)
  }, [missions, filter, currentPage])

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(0)
  }, [filter])
  
  return (
    <div className="min-h-screen bg-slate-950 font-mono relative overflow-x-hidden selection:bg-cyan/30 selection:text-cyan">
      
      {/* 🌌 Animated Tech Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Deep Space Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0f172a_0%,#020617_100%)]" />
        
        {/* Animated Grid System */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />
        
        {/* Floating Particles / Data Streams */}
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-cyan/20 to-transparent opacity-30 animate-pulse delay-700" />
        <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-violet/20 to-transparent opacity-30 animate-pulse delay-300" />
        <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald/10 to-transparent opacity-20 animate-ping" style={{animationDuration: '8s'}} />
        
        {/* Ambient Glows */}
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-violet-500/10 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] animate-pulse delay-1000" />
        
        {/* 👾 Pixel Sprites Layer - Desktop Only */}
        <div className="absolute inset-0 z-10 opacity-70">
            <ResponsiveBackgroundSprites />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10 relative">
        <div className="absolute -bottom-[1px] left-0 w-8 h-[1px] bg-cyan shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
        <div>
          <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">MISIONES</h1>
          {cefrLevel && <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-light">LEVEL</span>
            <span className="text-xs font-bold text-amber">{cefrLevel} // {getCefrLabel(cefrLevel).toUpperCase()}</span>
          </div>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
             <button onClick={logout} className="text-[10px] uppercase tracking-wider text-slate/50 hover:text-coral transition-colors px-2 py-1">Disconnect</button>
          </div>
          <div className="flex gap-1">
             {[1,2,3].map(i => <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i===1 ? "bg-emerald animate-pulse" : "bg-white/10")} />)}
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
        <div className="min-w-0">
          {/* Filters */}
          <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-none pb-2">
        {['all','A1','A2','B1','B2','C1'].map(l=>(
          <button key={l} onClick={()=>setFilter(l)} className={cn('relative px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-all skew-x-[-10deg]', 
            filter===l ? 'bg-cyan/10 border-cyan text-cyan shadow-[0_0_15px_-3px_rgba(6,182,212,0.4)]' : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30 hover:text-slate-300')}>
            <span className="skew-x-[10deg] inline-block">{l==='all'?'ALL_LEVELS':`${l}`}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-60 space-y-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-2 border-cyan/20 rounded-full animate-ping" />
            <div className="absolute inset-0 border-2 border-t-cyan border-r-transparent border-b-cyan/50 border-l-transparent rounded-full animate-spin" />
          </div>
          <p className="text-xs text-cyan animate-pulse tracking-widest">INITIALIZING...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Missions Container - 2 Column Grid */}
          <div className="grid grid-cols-2 gap-5">
            {paginatedMissions.map((m)=>{
              const st = STATUS[m.status as keyof typeof STATUS] ?? STATUS.not_started

              return (
                <div key={m.id}>
                  <Link
                    to={`/mission/${m.id}`}
                    className="group block relative"
                    onMouseEnter={() => prewarmIntroduction(m.id)}
                    onFocus={() => prewarmIntroduction(m.id)}
                  >
                    {/* Cyber Card Background */}
                    <div className={cn("absolute inset-0 border border-white/10 bg-black/40 backdrop-blur-sm transition-all duration-300 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] clip-path-cyber", 
                      m.status==='completed' ? 'opacity-80 grayscale-[0.8] border-dashed' : 'opacity-100'
                    )} />

                    {/* Fondo ambientado de la misión (el generado o el de respaldo).
                        En reposo queda apagado para que manden el título y la
                        descripción; al pasar el cursor se enciende como antes. */}
                    <div className={cn('absolute inset-0 overflow-hidden', m.status==='completed' && 'opacity-45 grayscale')}>
                      <MissionBackdrop
                        backdrop={resolveBackdrop(m.backdrop, `${m.title} ${m.scene_context ?? ''}`)}
                        variant="card"
                        seed={m.id}
                        className="opacity-40 transition-opacity duration-300 group-hover:opacity-70"
                      />
                      <div className="absolute inset-0 bg-slate-950/65 transition-colors duration-300 group-hover:bg-slate-950/50" />
                    </div>
                    
                    {/* Decorative Corners */}
                    <div className={cn("absolute top-0 left-0 w-2 h-2 border-t border-l transition-colors", 'border-white/20 group-hover:border-cyan')} />
                    <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b border-r transition-colors", 'border-white/20 group-hover:border-cyan')} />

                    <div className={cn("relative p-4 pr-8 flex flex-col gap-2 h-full", m.status==='completed' && 'opacity-60')}>
                      {/* Header with Level and ID */}
                      <div className="flex items-center gap-2">
                         <span className={cn('text-[12px] font-bold border px-2 py-1 rounded tracking-wider', LEVEL_COLORS[m.cefr_level], LEVEL_BG[m.cefr_level])}>{m.cefr_level}</span>
                         <span className="text-[10px] text-slate-500 font-body tracking-tighter">ID:{m.id}</span>
                         {st.label && <span className={cn('text-[10px] font-bold tracking-wider ml-auto', st.color)}>{st.label}</span>}
                      </div>
                      
                      <h3 className={cn("font-body font-semibold text-sm uppercase tracking-tight", 'text-white group-hover:text-cyan-400 transition-colors')}>{m.title}</h3>
                      <p className={cn("text-xs font-body line-clamp-2 leading-relaxed text-ellipsis", 'text-slate-300 opacity-90')}>{m.description}</p>
                      
                      {/* Status Indicator Bar */}
                      <div className={cn("w-1.5 h-1 rounded-full",
                         m.cefr_level === 'A1' ? 'bg-emerald' :
                         m.cefr_level === 'A2' ? 'bg-cyan' :
                         m.cefr_level === 'B1' ? 'bg-amber' :
                         m.cefr_level === 'B2' ? 'bg-violet' : 'bg-coral'
                      )} />
                      
                      {/* Progress Bar (Visual) */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-0.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                          <div className={cn("h-full w-0 transition-all duration-1000", 'group-hover:w-full',
                            m.cefr_level === 'A1' ? 'bg-emerald' : m.cefr_level === 'A2' ? 'bg-cyan' : m.cefr_level === 'B1' ? 'bg-amber' : m.cefr_level === 'B2' ? 'bg-violet' : 'bg-coral'
                          )} style={{ transitionDelay: '100ms' }} />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{Math.floor(m.base_duration_seconds/60)} MIN</span>
                      </div>

                      {/* Arrow Icon */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 text-cyan font-bold transition-all duration-300 transform -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100">
                        →
                      </div>
                    </div>

                    {/* Sello de misión completada, centrado sobre el contenido */}
                    {m.status === 'completed' && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                        <span className="-rotate-6 rounded-lg border border-emerald/50 bg-slate-950/70 px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-[0.3em] text-emerald shadow-[0_0_25px_-8px_rgba(16,185,129,0.9)] backdrop-blur-sm">
                          Completadas
                        </span>
                      </div>
                    )}
                  </Link>
                </div>
              )
            })}
            {paginatedMissions.length===0 && (
               <div className="col-span-2 border border-white/5 bg-white/5 p-8 text-center rounded-xl border-dashed">
                 <p className="text-xs text-slate-500 font-mono uppercase">No missions found in this sector.</p>
               </div>
            )}
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10">
              <button
                onClick={handlePrevPage}
                disabled={!canGoBack}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-all",
                  canGoBack
                    ? "bg-cyan/10 border-cyan/50 text-cyan hover:shadow-[0_0_15px_-3px_rgba(6,182,212,0.4)] hover:border-cyan cursor-pointer"
                    : "bg-white/5 border-white/10 text-slate-600 cursor-not-allowed opacity-50"
                )}
              >
                <span>←</span>
                <span>ANTERIOR</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>PÁG</span>
                <span className="bg-cyan/10 border border-cyan/30 px-2 py-1 rounded text-cyan font-bold">{currentPage + 1}</span>
                <span>/</span>
                <span className="text-slate-500">{totalPages || 1}</span>
              </div>

              <button
                onClick={handleNextPage}
                disabled={!canGoNext}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border transition-all",
                  canGoNext
                    ? "bg-cyan/10 border-cyan/50 text-cyan hover:shadow-[0_0_15px_-3px_rgba(6,182,212,0.4)] hover:border-cyan cursor-pointer"
                    : "bg-white/5 border-white/10 text-slate-600 cursor-not-allowed opacity-50"
                )}
              >
                <span>SIGUIENTE</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      )}
      
        </div>
        
        {/* Lateral: racha, retos y repaso, para no tapar las misiones */}
        <div className="space-y-6">
          <StreakBanner />
          <DailyQuests />
          <ReviewSession />
          <MissionSimulationAside />
        </div>
      </div>
      
    

      </div>
    </div>
  )
}
