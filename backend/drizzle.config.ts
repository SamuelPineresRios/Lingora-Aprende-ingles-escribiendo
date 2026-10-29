/**
 * Configuración de Drizzle Kit (push del esquema y futuras migraciones).
 *
 * Si `DATABASE_URL` viene del entorno (CI, Render o el script de Neon), se
 * respeta y no se carga `.env.local`; así un `db:push` de producción nunca
 * termina aplicándose a la base local por accidente. Sin variable, carga
 * `backend/.env.local` para el flujo de desarrollo.
 */
import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // Sin .env.local: se usa el entorno tal cual.
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error(
    'DATABASE_URL no está definida. Copia backend/.env.example a backend/.env.local.',
  )
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
