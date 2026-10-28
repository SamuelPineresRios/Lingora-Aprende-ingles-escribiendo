import { characterAvatarUrl } from '@/lib/avatar'
import { missionCharacters } from '../utils'
import type { Mission, MissionIntroduction } from '../types'

interface PreparationPhaseProps {
  mission: Mission
  introduction: MissionIntroduction | null
  studentAvatar: string | null
  isThinking: boolean
  onStartFree: () => void
  onStartChallenge: () => void
  onRepeatIntroduction: () => void
}

export function PreparationPhase({
  mission,
  introduction,
  studentAvatar,
  isThinking,
  onStartFree,
  onStartChallenge,
  onRepeatIntroduction,
}: PreparationPhaseProps) {
  const { ai, student } = missionCharacters(introduction)
  const expressions = introduction?.useful_expressions ?? []

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-950 font-body">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(8,51,68,0.5)_0%,rgba(2,6,23,0.95)_100%)]" />

      <div className="relative z-10 w-full max-w-3xl space-y-5">
        <div className="text-center space-y-1">
          <span className="text-[10px] text-cyan uppercase tracking-[0.25em]">Preparación</span>
          <h1 className="font-body text-3xl font-bold text-white uppercase tracking-tight">{mission.title}</h1>
          <p className="text-[11px] text-slate-500 font-mono uppercase tracking-widest">
            Nivel {mission.cefr_level} · {Math.round((mission.base_duration_seconds ?? 120) / 60)} min
          </p>
        </div>

        <div className="bg-slate-900/85 border border-white/10 rounded-xl p-4 border-l-2 border-cyan/40">
          <p className="text-[11px] text-cyan uppercase tracking-widest mb-1">La situación</p>
          <p className="text-[14px] text-slate-300 leading-relaxed">
            {introduction?.scene_description ?? mission.scene_context}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-slate-900/85 border border-cyan/25 rounded-xl p-4 flex items-center gap-3">
            <img
              src={characterAvatarUrl(ai?.name ?? mission.character_name, ai?.gender)}
              alt=""
              className="h-12 w-12 shrink-0 drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)]"
            />
            <div>
              <p className="text-[10px] text-cyan uppercase tracking-widest">Vas a hablar con</p>
              <p className="text-sm font-bold text-white">{ai?.name ?? mission.character_name}</p>
              <p className="text-[11px] text-slate-400">{ai?.role ?? 'Lo interpreta la IA'}</p>
            </div>
          </div>
          <div className="bg-slate-900/85 border border-emerald/25 rounded-xl p-4 flex items-center gap-3">
            {studentAvatar && (
              <img
                src={studentAvatar}
                alt=""
                className="h-12 w-12 shrink-0 drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)]"
              />
            )}
            <div>
              <p className="text-[10px] text-emerald uppercase tracking-widest">Tu papel</p>
              <p className="text-sm font-bold text-white">{student?.name ?? 'Tú'}</p>
              <p className="text-[11px] text-slate-400">
                {student?.role ?? 'Responde con tus propias palabras'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-cyan/10 border border-cyan/30 rounded-xl p-4">
          <p className="text-[11px] text-cyan uppercase tracking-widest mb-1">🎯 Tu objetivo</p>
          <p className="text-[14px] text-cyan-50 leading-relaxed">{mission.objective}</p>
        </div>

        {expressions.length > 0 && (
          <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-4">
            <p className="text-[11px] text-emerald uppercase tracking-widest mb-2">
              Expresiones que te servirán
            </p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {expressions.map((expression, index) => (
                <li
                  key={index}
                  className="text-[14px] text-emerald-50/85 border-l border-emerald/25 pl-2"
                >
                  {expression}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 mt-3">
              Son una orientación, no un guion: responde con tu propio inglés.
            </p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={onStartFree}
              disabled={isThinking}
              className="py-4 rounded-xl bg-slate-900/95 border border-slate-700 hover:border-cyan text-cyan font-bold uppercase tracking-widest transition-all disabled:opacity-50"
            >
              Realizar misión
              <span className="block text-[10px] text-slate-400 font-normal mt-1">Tiempo ilimitado</span>
            </button>
            <button
              onClick={onStartChallenge}
              disabled={isThinking}
              className="py-4 rounded-xl bg-slate-900/95 border border-amber/40 hover:border-amber hover:bg-amber/10 text-amber font-bold uppercase tracking-widest transition-all disabled:opacity-50"
            >
              Desafío
              <span className="block text-[10px] text-slate-400 font-normal mt-1">
                Tres corazones · 3:00 en total
              </span>
            </button>
          </div>

          {introduction && (
            <div className="flex justify-center text-[11px] font-mono uppercase tracking-widest">
              <button onClick={onRepeatIntroduction} className="text-slate-400 hover:text-cyan">
                ↻ Repetir escena
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
