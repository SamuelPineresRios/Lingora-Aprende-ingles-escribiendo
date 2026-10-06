/**
 * Precalienta el contenido de todas las misiones (escena y vocabulario).
 *
 *   npm run content:prewarm -w @vox/backend
 *   npm run content:prewarm -w @vox/backend -- --dry
 *
 * La lógica vive en `lib/prewarm-content.ts`, compartida con la generación y
 * el sembrado de misiones, que la llaman al terminar.
 */
import { prewarmMissingContent } from './lib/prewarm-content.ts'

const dry = process.argv.includes('--dry')

await prewarmMissingContent({ dry })
process.exit(0)
