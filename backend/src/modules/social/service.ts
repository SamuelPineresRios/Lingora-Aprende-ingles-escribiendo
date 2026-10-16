/**
 * Competición social: amistades, liga privada y retos 1v1 asíncronos.
 *
 * Las amistades son una fila por pareja (sin filas espejo): `requester_id`
 * pide y `addressee_id` recibe. La liga privada reutiliza la forma de entrada
 * del ranking global para que la interfaz pinte las mismas filas. Los retos
 * guardan la nota media de la evaluación de cada jugador; el ganador se
 * deriva al leer, así no hay estado que se pueda quedar desincronizado.
 */
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { evaluations, friendships, mission_challenges, missions, responses, users } from '../../db/schema.ts'
import { UNIQUE_VIOLATION, sqlStateOf } from '../../db/errors.ts'
import { generateFriendCode, normalizeFriendCode } from '../../lib/friend-code.ts'
import { HttpError } from '../../utils/http-error.ts'
import { rankingCosmetics, type RankingEntry, type RankingMetric } from '../students/service.ts'

/** Códigos de amigo por alumno: se generan al pedirlos o al registrarse. */
export async function ensureFriendCode(userId: string): Promise<string> {
  const [row] = await db.select({ friend_code: users.friend_code }).from(users).where(eq(users.id, userId)).limit(1)
  if (!row) throw new HttpError(404, 'Alumno no encontrado')
  if (row.friend_code) return row.friend_code

  // El índice único puede rechazar una colisión (poco probable): se reintenta.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateFriendCode()
    try {
      const [updated] = await db
        .update(users)
        .set({ friend_code: code })
        .where(and(eq(users.id, userId), isNull(users.friend_code)))
        .returning({ friend_code: users.friend_code })
      if (updated?.friend_code) return updated.friend_code
      // Otro proceso lo generó a la vez: se lee el que quedó.
      const [again] = await db.select({ friend_code: users.friend_code }).from(users).where(eq(users.id, userId)).limit(1)
      if (again?.friend_code) return again.friend_code
    } catch (err) {
      if (sqlStateOf(err) !== UNIQUE_VIOLATION) throw err
    }
  }
  throw new HttpError(500, 'No se pudo generar el código de amigo')
}

interface FriendStats {
  id: string
  name: string
  avatar: unknown
  xp: number
  missions: number
  seconds: number
  week_xp: number
}

/** Estadísticas de un conjunto de alumnos (misma forma que el ranking). */
async function statsFor(ids: string[]): Promise<Map<string, FriendStats>> {
  if (ids.length === 0) return new Map()

  const rows = await db
    .select({
      student_id: users.id,
      name: users.full_name,
      avatar: users.avatar,
      xp: sql<number>`coalesce(sum(${evaluations.xp_awarded}), 0)::int`,
      missions: sql<number>`count(distinct case when ${responses.status} = 'completed' then ${responses.mission_id} end)::int`,
      seconds: sql<number>`coalesce(sum(${responses.time_taken_seconds}), 0)::int`,
    })
    .from(users)
    .leftJoin(responses, eq(responses.student_id, users.id))
    .leftJoin(evaluations, eq(evaluations.response_id, responses.id))
    .where(inArray(users.id, ids))
    .groupBy(users.id, users.full_name, users.avatar)

  const weekStart = sql`date_trunc('week', now())`
  const weekRows = await db
    .select({
      student_id: responses.student_id,
      week_xp: sql<number>`coalesce(sum(${evaluations.xp_awarded}) filter (where ${responses.submitted_at} >= ${weekStart}), 0)::int`,
    })
    .from(responses)
    .leftJoin(evaluations, eq(evaluations.response_id, responses.id))
    .where(inArray(responses.student_id, ids))
    .groupBy(responses.student_id)

  const weekByStudent = new Map(weekRows.map(row => [row.student_id, row.week_xp]))
  return new Map(
    rows.map(row => [
      row.student_id,
      {
        id: row.student_id,
        name: row.name ?? 'Alumno',
        avatar: row.avatar,
        xp: row.xp,
        missions: row.missions,
        seconds: row.seconds,
        week_xp: weekByStudent.get(row.student_id) ?? 0,
      },
    ]),
  )
}

/** Amigos aceptados (ids) de un alumno. */
async function acceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ requester_id: friendships.requester_id, addressee_id: friendships.addressee_id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(eq(friendships.requester_id, userId), eq(friendships.addressee_id, userId)),
      ),
    )
  return rows.map(row => (row.requester_id === userId ? row.addressee_id : row.requester_id))
}

/** Vista completa de amistades: código propio, amigos y solicitudes. */
export async function listFriends(userId: string) {
  const code = await ensureFriendCode(userId)

  const rows = await db
    .select({
      id: friendships.id,
      requester_id: friendships.requester_id,
      addressee_id: friendships.addressee_id,
      status: friendships.status,
      created_at: friendships.created_at,
    })
    .from(friendships)
    .where(or(eq(friendships.requester_id, userId), eq(friendships.addressee_id, userId)))
    .orderBy(desc(friendships.created_at))

  const accepted = rows.filter(row => row.status === 'accepted')
  const incoming = rows.filter(row => row.status === 'pending' && row.addressee_id === userId)
  const outgoing = rows.filter(row => row.status === 'pending' && row.requester_id === userId)

  const otherIds = [...new Set([
    ...accepted.map(row => (row.requester_id === userId ? row.addressee_id : row.requester_id)),
    ...incoming.map(row => row.requester_id),
    ...outgoing.map(row => row.addressee_id),
  ])]
  const stats = await statsFor(otherIds)

  const toPerson = (id: string) => {
    const person = stats.get(id)
    return {
      id,
      name: person?.name ?? 'Alumno',
      avatar: person?.avatar ?? null,
      xp: person?.xp ?? 0,
      missions: person?.missions ?? 0,
      seconds: person?.seconds ?? 0,
      week_xp: person?.week_xp ?? 0,
    }
  }

  return {
    code,
    friends: accepted.map(row => toPerson(row.requester_id === userId ? row.addressee_id : row.requester_id)),
    incoming: incoming.map(row => ({ request_id: row.id, ...toPerson(row.requester_id) })),
    outgoing: outgoing.map(row => ({ request_id: row.id, ...toPerson(row.addressee_id) })),
  }
}

/** Envía una solicitud por código; si ya te la había enviado él, se acepta. */
export async function sendFriendRequest(requesterId: string, rawCode: string) {
  const code = normalizeFriendCode(rawCode)
  if (!code) throw new HttpError(400, 'Escribe un código de amigo')

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.friend_code, code))
    .limit(1)

  if (!target) throw new HttpError(404, 'No hay ningún alumno con ese código')
  if (target.id === requesterId) throw new HttpError(400, 'Ese código es el tuyo')
  if (target.role !== 'student') throw new HttpError(400, 'Ese código no es de un alumno')

  const [existing] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requester_id, requesterId), eq(friendships.addressee_id, target.id)),
        and(eq(friendships.requester_id, target.id), eq(friendships.addressee_id, requesterId)),
      ),
    )
    .limit(1)

  if (existing) {
    if (existing.status === 'accepted') throw new HttpError(409, 'Ya sois amigos')
    if (existing.requester_id === requesterId) throw new HttpError(409, 'La solicitud ya está enviada')
    // La solicitud venía del otro lado: enviarla ahora equivale a aceptarla.
    await db.update(friendships).set({ status: 'accepted' }).where(eq(friendships.id, existing.id))
    return { status: 'accepted' as const, friend_id: target.id }
  }

  await db.insert(friendships).values({
    id: randomUUID(),
    requester_id: requesterId,
    addressee_id: target.id,
    status: 'pending',
    created_at: new Date(),
  })
  return { status: 'pending' as const, friend_id: target.id }
}

/** Acepta o rechaza una solicitud recibida. */
export async function respondFriendRequest(userId: string, requestId: string, accept: boolean) {
  const [request] = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.id, requestId), eq(friendships.addressee_id, userId), eq(friendships.status, 'pending')))
    .limit(1)

  if (!request) throw new HttpError(404, 'Solicitud no encontrada')

  if (accept) {
    await db.update(friendships).set({ status: 'accepted' }).where(eq(friendships.id, request.id))
    return { status: 'accepted' as const }
  }

  await db.delete(friendships).where(eq(friendships.id, request.id))
  return { status: 'declined' as const }
}

/** Elimina una amistad (en cualquier dirección). */
export async function removeFriend(userId: string, friendId: string) {
  await db
    .delete(friendships)
    .where(
      or(
        and(eq(friendships.requester_id, userId), eq(friendships.addressee_id, friendId)),
        and(eq(friendships.requester_id, friendId), eq(friendships.addressee_id, userId)),
      ),
    )
  return { status: 'removed' as const }
}

/**
 * Liga privada: tú y tus amigos, con las mismas métricas que el ranking.
 *
 * Se reutiliza la forma de `RankingEntry` (posición, XP, misiones, segundos y
 * cosméticos) para que la interfaz comparta filas y estilos.
 */
export type FriendLeagueEntry = RankingEntry & { week_xp: number }

export async function friendsLeague(
  userId: string,
  metric: RankingMetric,
): Promise<{ metric: RankingMetric; entries: FriendLeagueEntry[] }> {
  const ids = [userId, ...(await acceptedFriendIds(userId))]

  const xpExpr = sql<number>`coalesce(sum(${evaluations.xp_awarded}), 0)::int`
  const missionsExpr = sql<number>`count(distinct case when ${responses.status} = 'completed' then ${responses.mission_id} end)::int`
  const secondsExpr = sql<number>`coalesce(sum(${responses.time_taken_seconds}), 0)::int`
  const orderExpr = metric === 'missions' ? missionsExpr : metric === 'time' ? secondsExpr : xpExpr

  const weekStart = sql`date_trunc('week', now())`
  const weekXpExpr = sql<number>`coalesce(sum(${evaluations.xp_awarded}) filter (where ${responses.submitted_at} >= ${weekStart}), 0)::int`

  const ranking = db
    .select({
      student_id: users.id,
      name: users.full_name,
      avatar: users.avatar,
      xp: xpExpr.as('xp'),
      missions: missionsExpr.as('missions'),
      seconds: secondsExpr.as('seconds'),
      week_xp: weekXpExpr.as('week_xp'),
      position: sql<number>`rank() over (order by ${orderExpr} desc, ${xpExpr} desc, ${users.full_name} asc)::int`.as('position'),
    })
    .from(users)
    .leftJoin(responses, eq(responses.student_id, users.id))
    .leftJoin(evaluations, eq(evaluations.response_id, responses.id))
    .where(and(eq(users.role, 'student'), inArray(users.id, ids)))
    .groupBy(users.id, users.full_name, users.avatar)
    .as('ranking')

  const rows = await db.select().from(ranking).orderBy(asc(ranking.position))
  const cosmetics = await rankingCosmetics(rows.map(row => row.student_id))

  return {
    metric,
    entries: rows.map(row => ({
      position: row.position,
      student_id: row.student_id,
      name: row.name ?? 'Alumno',
      avatar: row.avatar ?? null,
      frame: cosmetics.get(row.student_id)?.frame ?? null,
      titles: cosmetics.get(row.student_id)?.titles ?? [],
      medals: cosmetics.get(row.student_id)?.medals ?? [],
      xp: row.xp,
      missions: row.missions,
      seconds: row.seconds,
      week_xp: row.week_xp,
    })),
  }
}

export interface ChallengeView {
  id: string
  mission: { id: string; title: string; cefr_level: string }
  rival: { id: string; name: string; avatar: unknown }
  /** `incoming`: te retaron; `outgoing`: retaste tú. */
  direction: 'incoming' | 'outgoing'
  my_score: number | null
  rival_score: number | null
  state: 'pending' | 'waiting_you' | 'waiting_them' | 'finished' | 'declined'
  winner: 'me' | 'them' | 'draw' | null
  created_at: Date
}

/** Retos del alumno (enviados y recibidos), con estado y ganador derivados. */
export async function listChallenges(userId: string): Promise<ChallengeView[]> {
  const rows = await db
    .select({
      challenge: mission_challenges,
      mission_title: missions.title,
      mission_level: missions.cefr_level,
    })
    .from(mission_challenges)
    .innerJoin(missions, eq(missions.id, mission_challenges.mission_id))
    .where(or(eq(mission_challenges.challenger_id, userId), eq(mission_challenges.opponent_id, userId)))
    .orderBy(desc(mission_challenges.created_at))
    .limit(60)

  const rivalIds = [...new Set(rows.map(row =>
    row.challenge.challenger_id === userId ? row.challenge.opponent_id : row.challenge.challenger_id,
  ))]
  const stats = await statsFor(rivalIds)

  return rows.map(({ challenge, mission_title, mission_level }) => {
    const incoming = challenge.opponent_id === userId
    const myScore = incoming ? challenge.opponent_score : challenge.challenger_score
    const rivalScore = incoming ? challenge.challenger_score : challenge.opponent_score
    const rivalId = incoming ? challenge.challenger_id : challenge.opponent_id

    let state: ChallengeView['state']
    if (challenge.status === 'declined') state = 'declined'
    else if (myScore !== null && rivalScore !== null) state = 'finished'
    else if (myScore === null) state = 'waiting_you'
    else state = 'waiting_them'

    const winner =
      myScore !== null && rivalScore !== null
        ? myScore === rivalScore
          ? ('draw' as const)
          : myScore > rivalScore
            ? ('me' as const)
            : ('them' as const)
        : null

    return {
      id: challenge.id,
      mission: { id: challenge.mission_id, title: mission_title, cefr_level: mission_level },
      rival: {
        id: rivalId,
        name: stats.get(rivalId)?.name ?? 'Alumno',
        avatar: stats.get(rivalId)?.avatar ?? null,
      },
      direction: incoming ? ('incoming' as const) : ('outgoing' as const),
      my_score: myScore,
      rival_score: rivalScore,
      state,
      winner,
      created_at: challenge.created_at,
    }
  })
}

/** Crea un reto contra un amigo en una misión concreta. */
export async function createChallenge(challengerId: string, opponentId: string, missionId: string) {
  if (challengerId === opponentId) throw new HttpError(400, 'No puedes retarte a ti mismo')

  const friendIds = await acceptedFriendIds(challengerId)
  if (!friendIds.includes(opponentId)) throw new HttpError(403, 'Solo puedes retar a tus amigos')

  const [mission] = await db.select({ id: missions.id }).from(missions).where(eq(missions.id, missionId)).limit(1)
  if (!mission) throw new HttpError(404, 'Misión no encontrada')

  const [existing] = await db
    .select({ id: mission_challenges.id })
    .from(mission_challenges)
    .where(
      and(
        eq(mission_challenges.mission_id, missionId),
        eq(mission_challenges.status, 'pending'),
        or(
          and(eq(mission_challenges.challenger_id, challengerId), eq(mission_challenges.opponent_id, opponentId)),
          and(eq(mission_challenges.challenger_id, opponentId), eq(mission_challenges.opponent_id, challengerId)),
        ),
      ),
    )
    .limit(1)
  if (existing) throw new HttpError(409, 'Ya hay un reto en curso en esa misión')

  const id = randomUUID()
  await db.insert(mission_challenges).values({
    id,
    mission_id: missionId,
    challenger_id: challengerId,
    opponent_id: opponentId,
    challenger_score: null,
    opponent_score: null,
    status: 'pending',
    created_at: new Date(),
  })
  return { id }
}

/** Rechaza un reto recibido (solo el retado, y solo si aún no jugó). */
export async function declineChallenge(userId: string, challengeId: string) {
  const [challenge] = await db
    .select()
    .from(mission_challenges)
    .where(and(eq(mission_challenges.id, challengeId), eq(mission_challenges.opponent_id, userId)))
    .limit(1)

  if (!challenge) throw new HttpError(404, 'Reto no encontrado')
  if (challenge.status !== 'pending' || challenge.opponent_score !== null) {
    throw new HttpError(409, 'Ese reto ya no se puede rechazar')
  }

  await db.update(mission_challenges).set({ status: 'declined' }).where(eq(mission_challenges.id, challengeId))
  return { status: 'declined' as const }
}

/**
 * Guarda la nota de un jugador al completar la misión del reto.
 *
 * Se llama desde el envío de la misión; nunca debe romper ese flujo, así que
 * los errores se propagan al llamador solo si este decide capturarlos.
 */
export async function recordChallengeScore(studentId: string, missionId: string, score: number): Promise<void> {
  const rows = await db
    .select()
    .from(mission_challenges)
    .where(
      and(
        eq(mission_challenges.mission_id, missionId),
        eq(mission_challenges.status, 'pending'),
        or(eq(mission_challenges.challenger_id, studentId), eq(mission_challenges.opponent_id, studentId)),
      ),
    )

  for (const challenge of rows) {
    const isChallenger = challenge.challenger_id === studentId
    if (isChallenger && challenge.challenger_score !== null) continue
    if (!isChallenger && challenge.opponent_score !== null) continue

    const challengerScore = isChallenger ? score : challenge.challenger_score
    const opponentScore = isChallenger ? challenge.opponent_score : score
    const finished = challengerScore !== null && opponentScore !== null

    await db
      .update(mission_challenges)
      .set({
        challenger_score: challengerScore,
        opponent_score: opponentScore,
        status: finished ? 'finished' : 'pending',
        finished_at: finished ? new Date() : null,
      })
      .where(eq(mission_challenges.id, challenge.id))
  }
}
