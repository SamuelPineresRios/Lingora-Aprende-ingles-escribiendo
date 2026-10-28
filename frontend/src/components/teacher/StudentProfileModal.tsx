import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatDuration, cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { Star, Award, Clock } from 'lucide-react'

interface StudentProfile {
  full_name: string | null; email: string; cefr_level: string | null
  missions_completed: number; writing_time_seconds: number; avg_comprehensibility: number | null
  top_structures: { structure: string; count: number }[]
  stories_progress: { story_title: string; completed_scenes: number; total_scenes: number; status: string }[]
  weekly_stats: { week_start_date: string; missions_completed: number; writing_time_seconds: number; avg_comprehensibility: number | null }[]
  recent_responses: { id: string; text_content: string; submitted_at: string; judgment: string; comprehensibility_score: number; feedback_text: string }[]
  completed_missions?: any[]
}

interface StudentProfileModalProps {
  studentId: string
  onClose: () => void
}

interface CompletedMission {
  response_id: string
  mission_id: string
  title: string
  submitted_at: string
  time_taken_seconds: number | null
  comprehensibility_score: number | null
  grammar_score: number | null
  lexical_richness_score: number | null
  feedback_text: string | null
  answers: string[]
  qa_pairs?: { prompt: string | null; answer: string }[]
}

interface StudentProfileModalPropsExtended extends StudentProfileModalProps {
  groupId: string
}

export function StudentProfileModal({ studentId, groupId, onClose }: StudentProfileModalPropsExtended) {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'summary' | 'history'>('summary')

  useEffect(() => {
    fetch(`/api/teachers/students/${studentId}/profile?group_id=${encodeURIComponent(groupId)}`)
      .then(readJson).then(d => { setProfile(d); setLoading(false) })
  }, [studentId, groupId])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl lg:max-w-4xl bg-gradient-to-br from-[#0b1220] via-[#0f1724] to-[#071426] sm:rounded-2xl rounded-t-2xl border border-cyan-900/40 shadow-2xl max-h-[85vh] flex flex-col z-10 overflow-hidden">
        <div className="absolute -top-6 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400/30 via-indigo-500/40 to-emerald-400/20 animate-pulse" />
        <div className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-800 to-indigo-900 flex items-center justify-center text-xl font-bold text-white shadow-[0_0_18px_rgba(34,211,238,0.08)] border border-cyan-700/40">
              {(profile?.full_name ?? profile?.email ?? 'U')[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="font-display font-semibold text-xl text-white tracking-tight">{loading ? '...' : (profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Estudiante')}</h2>
              {profile?.cefr_level && <span className="text-[11px] font-mono text-cyan-300 mt-0.5">Nivel: {profile.cefr_level}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-600/20 to-indigo-600/10 text-xs font-mono text-cyan-300 border border-cyan-700/20">OPERADOR</div>
            <button onClick={onClose} className="text-slate-300 hover:text-white text-lg leading-none">✕</button>
          </div>
        </div>
        <div className="px-5 pb-4 border-b border-cyan-900/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-36 bg-slate-900/40 rounded-full p-1 border border-slate-800">
                <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-2 rounded-full" style={{ width: `${Math.min((profile?.missions_completed ?? 0) * 20, 100)}%` }} />
              </div>
                <div className="text-xs text-slate-300">
                <div className="font-mono text-2xl text-cyan-300">{profile?.missions_completed ?? 0}</div>
                <div className="text-[11px] text-slate-400">Misiones completadas</div>
              </div>
            </div>
            <div className="text-xs text-slate-400">Tiempo total: <span className="font-mono text-cyan-300">{formatDuration(profile?.writing_time_seconds ?? 0)}</span></div>
          </div>
        </div>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display font-semibold text-xl">{loading ? '...' : (profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Estudiante')}</h2>
            {profile?.cefr_level && <span className="text-xs text-cyan-300 font-mono">{profile.cefr_level}</span>}
          </div>
          <button onClick={onClose} className="text-slate-light hover:text-foreground text-lg leading-none">✕</button>
        </div>

        <div className="flex border-b border-cyan-900/20 px-5">
          {(['summary', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('py-2.5 text-xs font-medium mr-5 border-b-2 transition-colors',
                tab === t ? 'border-cyan text-cyan' : 'border-transparent text-slate-light hover:text-foreground')}>
              {t === 'summary' ? 'Resumen' : 'Historial'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-cyan-700/30 scrollbar-track-transparent text-base md:text-lg">
          {loading ? (
              <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin" />
            </div>
          ) : !profile ? (
            <p className="text-slate-light text-center text-sm">No se pudo cargar el perfil</p>
          ) : tab === 'summary' ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                  {[
                  { label: 'Misiones', value: profile.missions_completed, color: '' },
                  { label: 'Escritura', value: formatDuration(profile.writing_time_seconds), color: 'text-cyan' },
                  { label: 'Claridad', value: profile.avg_comprehensibility ? `${Math.round(profile.avg_comprehensibility)}%` : '—',
                    color: (profile.avg_comprehensibility ?? 0) >= 80 ? 'text-emerald' : (profile.avg_comprehensibility ?? 0) >= 65 ? 'text-cyan' : 'text-coral' },
                ].map(s => (
                  <div key={s.label} className="bg-gradient-to-br from-slate-900/30 to-slate-900/10 rounded-xl p-3 text-center border border-slate-800/60">
                    <p className={cn('font-display text-2xl font-bold', s.color)}>{s.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {profile.weekly_stats.length > 0 && (
                <div className="bg-gradient-to-br from-slate-900/30 to-slate-900/10 rounded-xl p-3 border border-slate-800/60">
                  <p className="text-xs text-slate-light mb-2">Evolución de claridad</p>
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[...profile.weekly_stats].reverse().map((w, i) => ({ week: `S${i+1}`, clarity: w.avg_comprehensibility ?? 0 }))}>
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#1C2430', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                          formatter={(v: number) => [`${Math.round(v)}%`, 'Claridad']} />
                        <Line type="monotone" dataKey="clarity" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {profile.top_structures.length > 0 && (
                <div className="bg-gradient-to-br from-slate-900/30 to-slate-900/10 rounded-xl p-3 border border-slate-800/60">
                  <p className="text-xs text-slate-light mb-2">Estructuras frecuentes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.top_structures.map((s, i) => (
                      <span key={i} className="text-xs font-mono bg-white/10 text-slate-lighter px-2 py-0.5 rounded-lg">
                        {s.structure} ×{s.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.stories_progress && profile.stories_progress.length > 0 && (
                <div className="bg-gradient-to-br from-slate-900/30 to-slate-900/10 rounded-xl p-3 border border-slate-800/60">
                  <p className="text-xs text-slate-light mb-2">Progreso en Historias</p>
                  <div className="space-y-2">
                    {profile.stories_progress.map((s, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-200">{s.story_title}</span>
                        <span className="text-cyan-300">{s.completed_scenes}/{s.total_scenes} ({s.status})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed missions details (group-specific) */}
              {Array.isArray((profile as any).completed_missions) && (profile as any).completed_missions.length > 0 && (
                <div className="bg-gradient-to-br from-slate-900/30 to-slate-900/10 rounded-xl p-3 border border-slate-800/60">
                  <p className="text-xs text-slate-light mb-2">Misiones completadas en este grupo</p>
                  <div className="space-y-2">
                    {(profile as any).completed_missions.map((m: CompletedMission) => (
                      <div key={m.response_id} className="bg-gradient-to-br from-[#071426] to-[#081124] rounded-lg p-3 border border-cyan-800/40 shadow-inner">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-lg text-white font-bold tracking-wide">{m.title}</p>
                            <p className="text-[11px] text-slate-400">{new Date(m.submitted_at).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono text-emerald-300">{m.comprehensibility_score ?? '—'}%</p>
                            <p className="text-[11px] text-slate-400">{m.time_taken_seconds ? formatDuration(m.time_taken_seconds) : '—'}</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-slate-400">Detalle de interacción</p>
                            <div className="flex items-center gap-2">
                              {m.comprehensibility_score !== null && (
                                <div className={cn('p-1 rounded-md', m.comprehensibility_score >= 90 ? 'bg-emerald-900/20' : m.comprehensibility_score >= 75 ? 'bg-cyan-900/20' : 'bg-slate-800/20')}>
                                  {m.comprehensibility_score >= 90 ? <Star className="w-4 h-4 text-emerald-300 animate-achievement-unlock" /> : m.comprehensibility_score >= 75 ? <Award className="w-4 h-4 text-cyan-300" /> : <Clock className="w-4 h-4 text-slate-400" />}
                                </div>
                              )}
                              <span className="text-xs font-mono text-slate-400">{m.comprehensibility_score ?? '—'}%</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {Array.isArray((m as any).qa_pairs) && (m as any).qa_pairs.length > 0 ? (
                              (m as any).qa_pairs.map((q: any, i: number) => (
                                <div key={i} className="grid grid-cols-[auto_1fr] gap-3 items-start">
                                  <div className="text-xs text-slate-400">Q:</div>
                                  <div className="text-base text-slate-300 bg-slate-900/30 px-3 py-1 rounded">{q.prompt ?? '—'}</div>
                                  <div />
                                  <div className="text-base text-slate-100 bg-gradient-to-r from-cyan-700/20 to-indigo-800/10 px-3 py-2 rounded">{q.answer}</div>
                                </div>
                              ))
                            ) : (m.answers.length === 0 ? (
                              <div className="text-[12px] text-slate-500">(Sin respuestas registradas)</div>
                            ) : m.answers.map((a, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 mt-2 rounded-full bg-cyan-400/70" />
                                <div className="bg-slate-800/40 px-3 py-1 rounded text-base text-slate-100">{a}</div>
                              </div>
                            )))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          ) : (
            <div className="space-y-3">
              {profile.recent_responses.length === 0 ? (
                <p className="text-slate-light text-sm text-center py-6">Sin respuestas todavía.</p>
              ) : profile.recent_responses.map(r => (
                    <div key={r.id} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded',
                      r.judgment === 'ADVANCE' ? 'bg-emerald/15 text-emerald' : 'bg-cyan/15 text-cyan')}>
                      {r.judgment === 'ADVANCE' ? '✓ AVANZÓ' : '↻ PAUSA'}
                    </span>
                    <span className="text-[10px] text-slate/50">
                      {new Date(r.submitted_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/70 italic mb-2 border-l-2 border-white/15 pl-2">&quot;{r.text_content}&quot;</p>
                  <p className="text-[11px] text-slate-light leading-relaxed">{r.feedback_text.split('\n\n')[0]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
