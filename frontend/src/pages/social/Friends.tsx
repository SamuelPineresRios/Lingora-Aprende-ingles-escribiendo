/**
 * Amigos: liga privada, solicitudes y retos 1v1 asíncronos.
 *
 * Todo cuelga de `/api/social`: la liga reutiliza la forma del ranking global
 * (posición, XP, misiones, segundos y cosméticos) y los retos se resuelven
 * solos al completar cada jugador la misión. El momento del jugador (a quién
 * tiene cerca) se calcula aquí a partir de la liga.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  Copy,
  Loader2,
  Swords,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react'
import { resolveAvatar } from '@vox/shared'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { useThemeAccent } from '@/lib/hooks/useStoreView'
import { FrameRing } from '@/components/profile/FrameRing'
import { ModuleBackdrop } from '@/components/layout/ModuleBackdrop'
import { studentAvatarUrl } from '@/lib/avatar'

type Metric = 'xp' | 'missions' | 'time'

interface FriendPerson {
  id: string
  name: string
  avatar: unknown
  xp: number
  missions: number
  seconds: number
  week_xp: number
}

interface FriendRequest extends FriendPerson {
  request_id: string
}

interface FriendsView {
  code: string
  friends: FriendPerson[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

interface LeagueEntry {
  position: number
  student_id: string
  name: string
  avatar: unknown
  frame: { id: string; colors: [string, string] } | null
  xp: number
  missions: number
  seconds: number
  week_xp: number
}

interface Challenge {
  id: string
  mission: { id: string; title: string; cefr_level: string }
  rival: { id: string; name: string; avatar: unknown }
  direction: 'incoming' | 'outgoing'
  my_score: number | null
  rival_score: number | null
  state: 'pending' | 'waiting_you' | 'waiting_them' | 'finished' | 'declined'
  winner: 'me' | 'them' | 'draw' | null
}

interface MissionOption {
  id: string
  title: string
}

const METRICS: Array<{ id: Metric; label: string; value: (entry: LeagueEntry) => number; unit: string }> = [
  { id: 'xp', label: 'XP', value: entry => entry.xp, unit: 'XP' },
  { id: 'missions', label: 'Misiones', value: entry => entry.missions, unit: 'misiones' },
  { id: 'time', label: 'Tiempo', value: entry => entry.seconds, unit: 'segundos' },
]

/** Tiempo de práctica legible: segundos, minutos u horas y minutos. */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** Avatar del alumno con su marco, como en el ranking. */
function FriendAvatar({ person, frame, accent, size = 56 }: {
  person: { id: string; avatar: unknown }
  frame?: { id: string; colors: [string, string] } | null
  accent?: string | null
  size?: number
}) {
  const image = (
    <img
      src={studentAvatarUrl(resolveAvatar({ id: person.id, avatar: person.avatar as never }))}
      alt=""
      className="h-full w-full object-contain"
    />
  )

  if (frame) {
    return (
      <FrameRing frameId={frame.id} colors={frame.colors} accent={accent} size={size}>
        <div className="flex h-full w-full items-center justify-center p-1">{image}</div>
      </FrameRing>
    )
  }

  return (
    <div className="shrink-0 rounded-full border border-white/10 bg-slate-950 p-1.5" style={{ width: size, height: size }}>
      <div className="h-full w-full overflow-hidden rounded-full">{image}</div>
    </div>
  )
}

export default function FriendsPage() {
  const { user } = useAuth()
  const accent = useThemeAccent(user?.id)
  const navigate = useNavigate()

  const [view, setView] = useState<FriendsView | null>(null)
  const [league, setLeague] = useState<LeagueEntry[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [metric, setMetric] = useState<Metric>('xp')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  /** Amigo al que se va a retar (abre el selector de misión). */
  const [challenging, setChallenging] = useState<FriendPerson | null>(null)
  const [missions, setMissions] = useState<MissionOption[]>([])
  const [missionPick, setMissionPick] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const [meRes, leagueRes, challengeRes] = await Promise.all([
        fetch('/api/social/me'),
        fetch(`/api/social/league?metric=${metric}`),
        fetch('/api/social/challenges'),
      ])
      if (!meRes.ok || !leagueRes.ok || !challengeRes.ok) throw new Error('No se pudo cargar la sección de amigos.')
      const [me, friendsLeague, challengeList] = await Promise.all([
        readJson<FriendsView>(meRes),
        readJson<{ entries: LeagueEntry[] }>(leagueRes),
        readJson<{ challenges: Challenge[] }>(challengeRes),
      ])
      setView(me)
      setLeague(friendsLeague?.entries ?? [])
      setChallenges(challengeList?.challenges ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la sección de amigos.')
    } finally {
      setLoading(false)
    }
  }, [user?.id, metric])

  useEffect(() => {
    void load()
  }, [load])

  // El selector de misión solo se pide al abrir el reto.
  useEffect(() => {
    if (!challenging || missions.length > 0) return
    fetch('/api/missions')
      .then(readJson<{ missions: MissionOption[] }>)
      .then(data => setMissions(data?.missions ?? []))
      .catch(() => setMissions([]))
  }, [challenging, missions.length])

  const activeMetric = useMemo(() => METRICS.find(item => item.id === metric) ?? METRICS[0]!, [metric])

  /** Momentum: mi fila, quién tengo justo delante y cuánto falta. */
  const momentum = useMemo(() => {
    const myIndex = league.findIndex(entry => entry.student_id === user?.id)
    if (myIndex === -1) return null
    const me = league[myIndex]!
    if (myIndex === 0) return { first: true as const, me }
    const ahead = league[myIndex - 1]!
    return {
      first: false as const,
      me,
      ahead,
      gap: Math.max(activeMetric.value(ahead) - activeMetric.value(me), 0),
    }
  }, [league, user?.id, activeMetric])

  const act = async (action: () => Promise<Response>, okMessage: string) => {
    if (busy) return
    setBusy(true)
    setNotice(null)
    setError('')
    try {
      const res = await action()
      if (!res.ok) {
        const data = await readJson<{ error?: string }>(res)
        throw new Error(data?.error ?? 'La acción no se pudo completar.')
      }
      setNotice(okMessage)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La acción no se pudo completar.')
    } finally {
      setBusy(false)
    }
  }

  const sendRequest = () => {
    const code = codeInput.trim()
    if (!code) return
    void act(
      () =>
        fetch('/api/social/friends/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }),
      'Solicitud enviada.',
    ).then(() => setCodeInput(''))
  }

  const respond = (requestId: string, accept: boolean) =>
    act(
      () =>
        fetch('/api/social/friends/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id: requestId, accept }),
        }),
      accept ? '¡Ya sois amigos!' : 'Solicitud rechazada.',
    )

  const createChallenge = () => {
    if (!challenging || !missionPick) return
    void act(
      () =>
        fetch('/api/social/challenges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opponent_id: challenging.id, mission_id: missionPick }),
        }),
      `Reto enviado a ${challenging.name}.`,
    ).then(() => {
      setChallenging(null)
      setMissionPick('')
    })
  }

  const declineChallenge = (id: string) =>
    act(() => fetch(`/api/social/challenges/${id}/decline`, { method: 'POST' }), 'Reto rechazado.')

  const revancha = (challenge: Challenge) =>
    act(
      () =>
        fetch('/api/social/challenges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opponent_id: challenge.rival.id, mission_id: challenge.mission.id }),
        }),
      `Revancha enviada a ${challenge.rival.name}.`,
    )

  const copyCode = async () => {
    if (!view?.code) return
    try {
      await navigator.clipboard.writeText(view.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Sin permiso de portapapeles: el código queda a la vista para copiarlo a mano.
    }
  }

  const pendientes = challenges.filter(challenge => challenge.state === 'waiting_you')
  const enCurso = challenges.filter(challenge => challenge.state === 'waiting_them' || challenge.state === 'pending')
  const terminados = challenges.filter(challenge => challenge.state === 'finished' || challenge.state === 'declined')

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <ModuleBackdrop />

      <div className="relative z-10 min-h-screen p-4 font-mono max-w-4xl mx-auto sm:p-8 space-y-8 animate-fade-in pt-16 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              AMIGOS
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">
              Liga privada · retos 1v1 · misma misión, mejor nota
            </p>
          </div>
          {view && (
            <button
              onClick={copyCode}
              title="Copiar tu código"
              className="flex items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/5 px-4 py-2.5 text-[11px] uppercase tracking-widest text-cyan transition-colors hover:bg-cyan/10"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Tu código: <span className="font-bold tracking-[0.2em]">{view.code}</span>
            </button>
          )}
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2 text-xs uppercase tracking-widest">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!loading && error && <p className="text-coral text-sm">{error}</p>}
        {!loading && notice && <p className="text-emerald text-sm">{notice}</p>}

        {!loading && view && (
          <>
            {/* Momentum: a quién tienes cerca en la liga */}
            {momentum && view.friends.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
                {momentum.first ? (
                  <p className="text-sm text-white">
                    Vas <span className="text-amber">primero</span> entre tus amigos.
                  </p>
                ) : (
                  <p className="text-sm text-white">
                    A <span className="text-amber">{activeMetric.value(momentum.ahead) - activeMetric.value(momentum.me)}</span>{' '}
                    {activeMetric.unit} de alcanzar a <span className="text-cyan">{momentum.ahead.name}</span>.
                  </p>
                )}
                {!momentum.first && (
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">
                    Esta semana: tú {momentum.me.week_xp} XP · {momentum.ahead.name} {momentum.ahead.week_xp} XP
                  </p>
                )}
              </div>
            )}

            {/* Liga privada */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
                  <Trophy className="h-4 w-4 text-cyan" /> Liga de amigos
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {METRICS.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setMetric(item.id)}
                      className={cn(
                        'px-3.5 py-1.5 rounded-lg border text-[10px] uppercase tracking-widest transition-colors',
                        item.id === metric
                          ? 'border-cyan/50 bg-cyan/10 text-cyan'
                          : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {league.length <= 1 ? (
                <div className="text-center py-14 border-2 border-dashed border-white/5 rounded-2xl space-y-3">
                  <UserPlus className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-slate-400 text-xs uppercase tracking-widest">Todavía compites solo</p>
                  <p className="text-[11px] text-slate-600">Comparte tu código y añade amigos para llenar la liga.</p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {league.map(entry => {
                    const isMe = entry.student_id === user?.id
                    return (
                      <li
                        key={entry.student_id}
                        className={cn(
                          'flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-colors sm:gap-5 sm:px-6',
                          isMe ? 'border-cyan/40 bg-cyan/10' : 'border-white/10 bg-black/20 hover:border-white/20',
                        )}
                      >
                        <span
                          className={cn(
                            'w-8 shrink-0 text-center font-body text-xl font-black',
                            entry.position === 1 ? 'text-amber' : 'text-slate-600',
                          )}
                        >
                          {entry.position}
                        </span>

                        <FriendAvatar person={{ id: entry.student_id, avatar: entry.avatar }} frame={entry.frame} accent={accent} />

                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-poppins text-sm font-semibold tracking-tight text-white">
                            <span className="truncate">{entry.name}</span>
                            {isMe && (
                              <span className="shrink-0 text-[9px] uppercase tracking-widest text-cyan border border-cyan/40 rounded px-1.5 py-0.5">
                                tú
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                            {entry.xp} XP · {entry.missions} {entry.missions === 1 ? 'misión' : 'misiones'} · {formatTime(entry.seconds)}
                          </p>
                        </div>

                        <span className="shrink-0 font-body text-lg font-bold text-slate-200">
                          {activeMetric.value(entry)}
                        </span>

                        {!isMe && (
                          <button
                            onClick={() => setChallenging(view.friends.find(friend => friend.id === entry.student_id) ?? null)}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-coral/40 px-3 py-2 text-[10px] uppercase tracking-widest text-coral transition-colors hover:bg-coral/10"
                          >
                            <Swords className="h-3.5 w-3.5" /> Retar
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            {/* Retos */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
                <Swords className="h-4 w-4 text-coral" /> Retos 1v1
              </h2>

              {pendientes.length === 0 && enCurso.length === 0 && terminados.length === 0 && (
                <p className="text-[11px] text-slate-600">
                  Sin retos todavía: pulsa «Retar» en un amigo y elegid la misma misión.
                </p>
              )}

              <div className="grid gap-2.5 sm:grid-cols-2">
                {[...pendientes, ...enCurso, ...terminados].map(challenge => (
                  <article
                    key={challenge.id}
                    className={cn(
                      'rounded-2xl border px-4 py-4 space-y-3',
                      challenge.state === 'waiting_you'
                        ? 'border-coral/40 bg-coral/5'
                        : 'border-white/10 bg-black/20',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <FriendAvatar person={{ id: challenge.rival.id, avatar: challenge.rival.avatar }} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{challenge.rival.name}</p>
                        <p className="truncate text-[10px] uppercase tracking-widest text-slate-500">
                          {challenge.mission.title} · {challenge.mission.cefr_level}
                        </p>
                      </div>
                      {challenge.state === 'finished' && (
                        <span
                          className={cn(
                            'shrink-0 rounded-lg border px-2.5 py-1 text-[10px] uppercase tracking-widest',
                            challenge.winner === 'me'
                              ? 'border-emerald/50 bg-emerald/10 text-emerald'
                              : challenge.winner === 'draw'
                                ? 'border-white/20 text-slate-300'
                                : 'border-coral/50 bg-coral/10 text-coral',
                          )}
                        >
                          {challenge.winner === 'me' ? 'Ganaste' : challenge.winner === 'draw' ? 'Empate' : 'Perdiste'}
                        </span>
                      )}
                    </div>

                    {challenge.state === 'finished' && (
                      <p className="text-[11px] text-slate-400">
                        Tú {challenge.my_score} · {challenge.rival.name} {challenge.rival_score}
                      </p>
                    )}

                    {challenge.state === 'waiting_you' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => navigate(`/mission/${challenge.mission.id}`)}
                          className="flex-1 rounded-xl bg-cyan py-2.5 text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-cyan-400"
                        >
                          {challenge.direction === 'incoming' ? 'Aceptar y jugar' : 'Jugar mi reto'}
                        </button>
                        {challenge.direction === 'incoming' && (
                          <button
                            onClick={() => declineChallenge(challenge.id)}
                            className="rounded-xl border border-white/15 px-3 py-2.5 text-[10px] uppercase tracking-widest text-slate-300 transition-colors hover:border-coral/50 hover:text-coral"
                          >
                            Rechazar
                          </button>
                        )}
                      </div>
                    )}

                    {challenge.state === 'waiting_them' && (
                      <p className="text-[11px] text-slate-500">
                        Esperando a que {challenge.rival.name} juegue{challenge.my_score !== null ? ` (tu nota: ${challenge.my_score})` : ''}…
                      </p>
                    )}

                    {challenge.state === 'declined' && (
                      <p className="text-[11px] text-slate-500">Reto rechazado.</p>
                    )}

                    {challenge.state === 'finished' && (
                      <button
                        onClick={() => revancha(challenge)}
                        className="w-full rounded-xl border border-white/15 py-2.5 text-[10px] uppercase tracking-widest text-slate-300 transition-colors hover:border-coral/50 hover:text-coral"
                      >
                        Revancha
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {/* Solicitudes y alta por código */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
                <UserPlus className="h-4 w-4 text-cyan" /> Añadir amigos
              </h2>

              <div className="flex flex-wrap gap-2">
                <input
                  value={codeInput}
                  onChange={event => setCodeInput(event.target.value.toUpperCase())}
                  placeholder="Código de tu amigo"
                  maxLength={8}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm uppercase tracking-[0.2em] text-white placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
                />
                <button
                  onClick={sendRequest}
                  disabled={busy || codeInput.trim().length < 4}
                  className={cn(
                    'rounded-xl border px-5 py-3 text-[11px] uppercase tracking-widest transition-colors',
                    codeInput.trim().length >= 4 && !busy
                      ? 'border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20'
                      : 'cursor-not-allowed border-white/10 text-slate-600',
                  )}
                >
                  Enviar solicitud
                </button>
              </div>

              {view.incoming.length > 0 && (
                <ul className="space-y-2">
                  {view.incoming.map(request => (
                    <li
                      key={request.request_id}
                      className="flex items-center gap-3 rounded-2xl border border-cyan/30 bg-cyan/5 px-4 py-3"
                    >
                      <FriendAvatar person={request} size={44} />
                      <p className="min-w-0 flex-1 truncate text-sm text-white">
                        {request.name} quiere ser tu amigo
                      </p>
                      <button
                        onClick={() => respond(request.request_id, true)}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-xl border border-emerald/50 bg-emerald/10 px-3 py-2 text-[10px] uppercase tracking-widest text-emerald transition-colors hover:bg-emerald/20"
                      >
                        <Check className="h-3.5 w-3.5" /> Aceptar
                      </button>
                      <button
                        onClick={() => respond(request.request_id, false)}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-[10px] uppercase tracking-widest text-slate-300 transition-colors hover:border-coral/50 hover:text-coral"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {view.outgoing.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  Esperando respuesta de {view.outgoing.map(person => person.name).join(', ')}…
                </p>
              )}

              {view.friends.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  {view.friends.length} {view.friends.length === 1 ? 'amigo' : 'amigos'}:{' '}
                  {view.friends.map(friend => friend.name).join(', ')}
                </p>
              )}
            </section>
          </>
        )}
      </div>

      {/* Selector de misión del reto */}
      {challenging && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 space-y-4">
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-coral">Reto 1v1</p>
                <h3 className="text-lg font-bold text-white">Reta a {challenging.name}</h3>
              </div>
              <button
                onClick={() => { setChallenging(null); setMissionPick('') }}
                className="text-slate-400 transition-colors hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <p className="text-[12px] text-slate-400">
              Elegid la misma misión: gana quien saque mejor nota media en la conversación.
            </p>

            <select
              value={missionPick}
              onChange={event => setMissionPick(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 font-mono text-sm text-white focus:border-cyan/50 focus:outline-none"
            >
              <option value="">Elige una misión…</option>
              {missions.map(mission => (
                <option key={mission.id} value={mission.id}>
                  {mission.title}
                </option>
              ))}
            </select>

            <button
              onClick={createChallenge}
              disabled={!missionPick || busy}
              className={cn(
                'w-full rounded-xl py-3 text-[11px] font-bold uppercase tracking-widest transition-colors',
                missionPick && !busy ? 'bg-cyan text-black hover:bg-cyan-400' : 'cursor-not-allowed bg-white/10 text-slate-600',
              )}
            >
              Enviar reto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
