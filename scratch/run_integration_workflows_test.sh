#!/usr/bin/env bash
# Sobe um ambiente descartável (PostgreSQL + API) com Podman e executa scratch/test_integration_workflows.py.
# Requer: podman e python3. O backend é compilado no container do SDK .NET 8.
# Não toca em bancos existentes: usa o banco sicou_integration_test no container sicou-postgres (127.0.0.1:5434).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG=sicou-postgres
DB=sicou_integration_test
API=sicou-integration-api
PORT=5185
RATE=150
SDK=mcr.microsoft.com/dotnet/sdk:8.0

podman run --rm -v "$ROOT/backend":/src:Z -v sicou-nuget:/root/.nuget/packages -w /src "$SDK" \
  dotnet build Sicou.sln -nologo -v q | grep -E "error|Error" || true

if ! podman container exists "$PG"; then
  podman run -d --name "$PG" -p 127.0.0.1:5434:5432 -e POSTGRES_PASSWORD=postgres \
    -v sicou-pgdata:/var/lib/postgresql/data docker.io/library/postgres:16 >/dev/null
fi
podman start "$PG" >/dev/null
until podman exec "$PG" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
podman exec "$PG" psql -U postgres -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE);" -c "CREATE DATABASE $DB;"

start_api() {
  podman rm -f "$API" >/dev/null 2>&1 || true
  podman run -d --name "$API" --network host -v "$ROOT/backend":/src:Z -w /src/src/Api \
    -e ASPNETCORE_ENVIRONMENT=Development -e ASPNETCORE_URLS="http://127.0.0.1:$PORT" \
    -e ConnectionStrings__DefaultConnection="Host=127.0.0.1;Port=5434;Database=$DB;Username=postgres;Password=postgres" \
    -e Integrations__RequestsPerMinute="$RATE" \
    "$SDK" dotnet bin/Debug/net8.0/Sicou.Api.dll >/dev/null
  for _ in $(seq 1 90); do
    curl -sf "http://127.0.0.1:$PORT/swagger/integrations/swagger.json" >/dev/null && return 0
    sleep 1
  done
  podman logs --tail 50 "$API"; return 1
}
trap 'podman rm -f "$API" >/dev/null 2>&1 || true' EXIT

start_api
EMAIL="admin.integracao@example.test"
PASSWORD="Adm$(openssl rand -hex 6)x9"
curl -sf -X POST "http://127.0.0.1:$PORT/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"fullName\":\"Admin Integração\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" >/dev/null
podman exec -i "$PG" psql -U postgres -d "$DB" -q <<SQL
INSERT INTO user_roles ("UserId", "RoleId")
SELECT u."Id", r."Id" FROM users u, roles r WHERE u."Email" = '$EMAIL' AND r."Name" = 'SUPER_ADMIN';
SQL
JWT=$(curl -sf -X POST "http://127.0.0.1:$PORT/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')
curl -sf -X POST "http://127.0.0.1:$PORT/api/companies" -H 'Content-Type: application/json' -H "Authorization: Bearer $JWT" \
  -d '{"name":"Empresa Integração Teste"}' >/dev/null

# Reinicia para o seeder criar o setor de RH, unidades e o workflow homologado RH-CONTRATACAO.
start_api

SICOU_TEST_ADMIN_EMAIL="$EMAIL" SICOU_TEST_ADMIN_PASSWORD="$PASSWORD" SICOU_TEST_RATE_LIMIT="$RATE" \
SICOU_TEST_PSQL="podman exec -i $PG psql -U postgres -d $DB -tA" \
  python3 "$ROOT/scratch/test_integration_workflows.py" "http://127.0.0.1:$PORT"
