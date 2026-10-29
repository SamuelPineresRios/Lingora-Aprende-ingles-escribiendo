#!/usr/bin/env bash
#
# Copia las 170 misiones, sus escenas y su vocabulario desde la base local a
# Neon, sin volver a generar contenido con IA.
#
# Uso:
#   LOCAL_DATABASE_URL="postgresql://..." \
#   NEON_DIRECT_URL="postgresql://...neon.tech/neondb?sslmode=require" \
#   npm run deploy:content
#
# NEON_DIRECT_URL debe ser la conexión directa (sin -pooler): se usa para
# aplicar el esquema y restaurar los datos. La API usará la conexión pooled.
set -euo pipefail

: "${LOCAL_DATABASE_URL:?Define LOCAL_DATABASE_URL con la base local}"
: "${NEON_DIRECT_URL:?Define NEON_DIRECT_URL con la conexión directa de Neon}"

for command in npm pg_dump psql; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Falta el comando '$command' en PATH." >&2
    exit 1
  }
done

cd "$(dirname "$0")/.."

echo "Aplicando el esquema en Neon..."
DATABASE_URL="$NEON_DIRECT_URL" npm run db:push -w @vox/backend

if ! psql "$NEON_DIRECT_URL" -tAc "select to_regclass('public.missions')" | grep -qx 'missions'; then
  echo "El esquema no se aplicó en Neon: no existe public.missions." >&2
  echo "Comprueba que NEON_DIRECT_URL sea la conexión directa de Neon (sin -pooler)" >&2
  echo "y que no sea la URL local de backend/.env.local." >&2
  exit 1
fi

existing="$(psql "$NEON_DIRECT_URL" -tAc 'select count(*) from missions' | tr -d '[:space:]')"
if [ "$existing" != "0" ]; then
  echo "Neon ya tiene $existing misiones. No se sobrescribe nada." >&2
  echo "Usa una base nueva o vacía mission_vocabulary, mission_introductions y missions." >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "Exportando contenido local..."
pg_dump "$LOCAL_DATABASE_URL" --data-only --no-owner --no-acl \
  --table=missions > "$tmpdir/missions.sql"
pg_dump "$LOCAL_DATABASE_URL" --data-only --no-owner --no-acl \
  --table=mission_introductions > "$tmpdir/introductions.sql"
pg_dump "$LOCAL_DATABASE_URL" --data-only --no-owner --no-acl \
  --table=mission_vocabulary > "$tmpdir/vocabulary.sql"

echo "Restaurando misiones..."
psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 -f "$tmpdir/missions.sql" >/dev/null
echo "Restaurando escenas..."
psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 -f "$tmpdir/introductions.sql" >/dev/null
echo "Restaurando vocabulario..."
psql "$NEON_DIRECT_URL" -v ON_ERROR_STOP=1 -f "$tmpdir/vocabulary.sql" >/dev/null

echo
psql "$NEON_DIRECT_URL" -P pager=off -c "
  SELECT
    (SELECT count(*) FROM missions) AS misiones,
    (SELECT count(*) FROM mission_introductions) AS escenas,
    (SELECT count(*) FROM mission_vocabulary) AS vocabularios,
    (SELECT count(*) FROM missions WHERE id BETWEEN 'm-151' AND 'm-170') AS dev;
"

echo "Contenido copiado. La API debe usar la cadena pooled de Neon."
