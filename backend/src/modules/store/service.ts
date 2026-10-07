/**
 * Tienda y monedas.
 *
 * El saldo es el del pase (monedas de temporada + libro de movimientos). Los
 * artículos no consumibles se registran en `purchases` (una vez por alumno) y
 * lo que se lleva puesto en `student_loadout`; los escudos son consumibles y
 * viven en `streak_shields` hasta que salvan un día.
 */
import { randomUUID } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { coin_ledger, purchases, streak_shields, student_loadout } from '../../db/schema.ts'
import { HttpError } from '../../utils/http-error.ts'
import { getCoinBalance } from '../season/service.ts'
import { STORE_ITEMS, findStoreItem, type StoreItem } from '../../lib/store.ts'

export interface StoreLoadout {
  frame_id: string | null
  title_id: string | null
  theme_id: string | null
}

export interface StoreView {
  balance: number
  /** Escudos de racha sin usar. */
  shields: number
  items: Array<StoreItem & { owned: boolean; equipped: boolean }>
  loadout: StoreLoadout
}

/** Escudos disponibles (comprados y sin gastar). */
export async function getShieldCount(studentId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(streak_shields)
    .where(and(eq(streak_shields.student_id, studentId), isNull(streak_shields.used_for_day)))
  return row?.total ?? 0
}

async function findLoadout(studentId: string): Promise<StoreLoadout> {
  const [row] = await db
    .select()
    .from(student_loadout)
    .where(eq(student_loadout.student_id, studentId))
    .limit(1)

  return {
    frame_id: row?.frame_id ?? null,
    title_id: row?.title_id ?? null,
    theme_id: row?.theme_id ?? null,
  }
}

/** Tienda del alumno: saldo, escudos y catálogo con lo que ya tiene puesto. */
export async function getStudentStore(studentId: string): Promise<StoreView> {
  const [balance, shields, ownedRows, loadout] = await Promise.all([
    getCoinBalance(studentId),
    getShieldCount(studentId),
    db.select({ item_id: purchases.item_id }).from(purchases).where(eq(purchases.student_id, studentId)),
    findLoadout(studentId),
  ])

  const owned = new Set(ownedRows.map(row => row.item_id))
  const equipped = new Set([loadout.frame_id, loadout.title_id, loadout.theme_id].filter(Boolean))

  return {
    balance,
    shields,
    items: STORE_ITEMS.map(item => ({
      ...item,
      owned: owned.has(item.id),
      equipped: equipped.has(item.id),
    })),
    loadout,
  }
}

/**
 * Compra un artículo. Valida saldo y, en los no consumibles, que no lo tenga
 * ya; el cobro y el registro van en la misma transacción.
 */
export async function purchaseItem(studentId: string, rawItemId: unknown): Promise<StoreView> {
  const itemId = typeof rawItemId === 'string' ? rawItemId : ''
  const item = findStoreItem(itemId)
  if (!item) throw new HttpError(404, 'Artículo no encontrado')

  if ((await getCoinBalance(studentId)) < item.price) {
    throw new HttpError(400, 'No tienes monedas suficientes')
  }

  await db.transaction(async tx => {
    if (!item.consumable) {
      const [existing] = await tx
        .select({ id: purchases.id })
        .from(purchases)
        .where(and(eq(purchases.student_id, studentId), eq(purchases.item_id, itemId)))
        .limit(1)
      if (existing) throw new HttpError(400, 'Ya tienes ese artículo')
    }

    await tx.insert(coin_ledger).values({
      id: randomUUID(),
      student_id: studentId,
      amount: -item.price,
      reason: 'shop',
      ref: item.id,
      created_at: new Date(),
    })

    if (item.consumable) {
      await tx.insert(streak_shields).values({
        id: randomUUID(),
        student_id: studentId,
        used_for_day: null,
        created_at: new Date(),
      })
    } else {
      await tx.insert(purchases).values({
        id: randomUUID(),
        student_id: studentId,
        item_id: item.id,
        created_at: new Date(),
      })
    }
  })

  return getStudentStore(studentId)
}

/** Se pone un artículo comprado (marco, título o tema). */
export async function equipItem(studentId: string, rawItemId: unknown): Promise<StoreView> {
  const itemId = typeof rawItemId === 'string' ? rawItemId : ''
  const item = findStoreItem(itemId)
  if (!item) throw new HttpError(404, 'Artículo no encontrado')
  if (item.consumable) throw new HttpError(400, 'Los escudos se usan, no se equipan')

  const [owned] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(and(eq(purchases.student_id, studentId), eq(purchases.item_id, itemId)))
    .limit(1)
  if (!owned) throw new HttpError(403, 'No tienes ese artículo')

  const patch =
    item.kind === 'frame'
      ? { frame_id: item.id }
      : item.kind === 'title'
        ? { title_id: item.id }
        : { theme_id: item.id }

  await db
    .insert(student_loadout)
    .values({ student_id: studentId, ...patch, updated_at: new Date() })
    .onConflictDoUpdate({
      target: student_loadout.student_id,
      set: { ...patch, updated_at: new Date() },
    })

  return getStudentStore(studentId)
}
