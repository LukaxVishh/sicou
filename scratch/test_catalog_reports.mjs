// Local isolated database only. Creates its own synthetic fixtures, never sends email.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const base = "http://localhost:5185/api/";
const database = (await readFile(".cache/reports-test-db.txt", "utf8"))
  .replace(/^\uFEFF/, "")
  .trim();
assert.match(database, /^reports_test_[a-f0-9]+$/);
const sql = (text) =>
  execFileSync(
    "C:/Program Files/PostgreSQL/17/bin/psql.exe",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "55439",
      "-U",
      "guide_test",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      text,
    ],
    { encoding: "utf8" },
  );
const suffix = randomBytes(6).toString("hex"),
  password = "Cat!" + randomBytes(12).toString("hex");
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log("OK " + label);
}
async function request(
  path,
  token,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${response.status === expected ? "" : await response.text()}`,
  );
  if (expected >= 400) {
    checks++;
    console.log("OK rejeição " + expected + " " + path);
    return;
  }
  if (expected === 204) return;
  return response.headers.get("Content-Type")?.includes("json")
    ? response.json()
    : Buffer.from(await response.arrayBuffer());
}
const login = async (email) =>
  (await request("auth/login", null, { email, password })).accessToken;
const email = `catalog.super.${suffix}@example.test`;
await request("auth/register", null, {
  fullName: "Catalog Super",
  email,
  password,
});
sql(
  `INSERT INTO user_roles ("UserId","RoleId") SELECT u."Id",r."Id" FROM users u CROSS JOIN roles r WHERE u."Email"='${email}' AND r."Name"='SUPER_ADMIN'`,
);
const superToken = await login(email);
const a = await request(
  "companies",
  superToken,
  { name: "Catalog A " + suffix },
  "POST",
  201,
);
const b = await request(
  "companies",
  superToken,
  { name: "Catalog B " + suffix },
  "POST",
  201,
);
const unit = (name, city) =>
  request(
    `companies/${a.id}/units`,
    superToken,
    { name, code: name, city, state: "PR" },
    "POST",
    201,
  );
const u1 = await unit("Cascavel", "Cascavel"),
  u2 = await unit("Toledo", "Toledo"),
  u3 = await unit("Inativa", "Curitiba");
await request("units/" + u3.id, superToken, null, "DELETE", 204);
const area = (company, name) =>
  request(
    `companies/${company}/areas`,
    superToken,
    { name, moduleCodes: ["Guide"] },
    "POST",
    201,
  );
const ar = await area(a.id, "GuideOnly"),
  hiddenArea = await area(a.id, "Setor restrito"),
  foreignArea = await area(b.id, "Outra empresa");
async function user(name, role, unitId = null, access = null) {
  const email = `catalog.${name}.${suffix}@example.test`;
  const result = await request(
    "users",
    superToken,
    { fullName: name, email, password, roles: [role], companyId: a.id, unitId },
    "POST",
    201,
  );
  if (access)
    await request(
      "user-area-accesses",
      superToken,
      {
        userId: result.id,
        companyId: a.id,
        unitId,
        areaId: ar.id,
        canView: !access.manage,
        canManageGuide: access.manage,
      },
      "POST",
      201,
    );
  return { ...result, token: await login(email) };
}
const admin = await user("admin", "COMPANY_ADMIN");
const reader = await user("reader", "HEADQUARTER_USER", null, {
  manage: false,
});
const manager = await user("manager", "AREA_ADMIN", null, { manage: true });
const branch = await user("branch", "UNIT_USER", u1.id, { manage: false });
const inactive = await user("inactive", "UNIT_USER", u1.id);
await request("users/" + inactive.id, superToken, null, "DELETE", 204);
const category = (areaId, name) =>
  request(
    `areas/${areaId}/guide/categories`,
    superToken,
    { name },
    "POST",
    201,
  );
const cat = await category(ar.id, "Publicações"),
  privateCat = await category(ar.id, "Categoria só de rascunho");
const hiddenCat = await category(hiddenArea.id, "Restrita"),
  foreignCat = await category(foreignArea.id, "Externa");
async function item(areaId, categoryId, title, published = true) {
  return request(
    `areas/${areaId}/guide/items`,
    superToken,
    {
      categoryId,
      title,
      content: "Conteúdo de orientação. ".repeat(40),
      isPublished: published,
    },
    "POST",
    201,
  );
}
const pub = await item(ar.id, cat.id, "Guia público 🚚");
await item(ar.id, cat.id, "Rascunho", false);
await item(ar.id, privateCat.id, "Rascunho privado", false);
await item(hiddenArea.id, hiddenCat.id, "Setor sem acesso");
await item(foreignArea.id, foreignCat.id, "Segredo externo");
const report = (kind, token, query = "") =>
  request(`reports/catalog/${kind}?${query}`, token);
check(
  (await report("units", admin.token)).total === 3,
  "unidades da empresa incluindo inativas",
);
check(
  (await report("units", admin.token, "status=inactive")).items[0].id === u3.id,
  "filtro de unidade inativa",
);
const city = await report(
  "units",
  admin.token,
  "city=casc&state=pr&status=active",
);
check(
  city.total === 1 && city.items[0].values.users === 1,
  "localização e contagem de usuários ativos",
);
check(
  (await report("users", admin.token, "status=inactive")).items[0].id ===
    inactive.id,
  "usuários inativos continuam consultáveis",
);
check(
  (await report("users", admin.token, "role=AREA_ADMIN")).items[0].id ===
    manager.id,
  "filtro por perfil",
);
check(
  (await report("users", admin.token, "unitId=" + u1.id)).total === 2,
  "filtro de usuários por unidade",
);
check(
  (await report("users", admin.token, "search=reader")).items[0].id ===
    reader.id,
  "busca por nome",
);
check(
  !JSON.stringify(await report("users", admin.token)).match(
    /password|securityStamp|token/i,
  ),
  "relatório não expõe credenciais",
);
const units1 = await report("units", admin.token, "page=1&pageSize=1"),
  units2 = await report("units", admin.token, "page=2&pageSize=1");
check(
  units1.items[0].id !== units2.items[0].id,
  "paginação estável de unidades",
);
check(
  (await report("guides", reader.token)).total === 1,
  "leitor vê apenas a publicação de seu setor",
);
check(
  (await report("guides", reader.token, "status=draft")).total === 0,
  "leitor não exporta nem lista rascunhos",
);
check(
  (await report("guides", manager.token, "status=draft")).total === 2,
  "gestor do Orientador vê rascunhos sem permissão de workflow",
);
check(
  (await report("guides", admin.token)).total === 4,
  "admin vê somente orientações da própria empresa",
);
const filtered = await report(
  "guides",
  admin.token,
  `areaId=${ar.id}&categoryId=${cat.id}&status=published`,
);
check(
  filtered.total === 1 &&
    filtered.items[0].id === pub.id &&
    filtered.items[0].values.summary.length === 500,
  "categoria, publicação e resumo limitado",
);
check(
  (
    await report(
      "guides",
      admin.token,
      "startDate=2000-01-01&endDate=2000-01-01",
    )
  ).total === 0,
  "período de criação",
);
const options = await request("reports/catalog/options", reader.token);
check(
  options.kinds.join(",") === "guides" &&
    options.areas.length === 1 &&
    !options.categories.some((c) => c.id === privateCat.id),
  "opções não revelam cadastros ou categorias privadas",
);
for (const kind of ["units", "users"]) {
  await request("reports/catalog/" + kind, reader.token, null, "GET", 403);
  await request(
    `reports/catalog/${kind}/export/csv`,
    reader.token,
    null,
    "GET",
    403,
  );
}
await request(
  `reports/catalog/users?companyId=${b.id}`,
  admin.token,
  null,
  "GET",
  403,
);
await request(
  `reports/catalog/guides?areaId=${hiddenArea.id}`,
  reader.token,
  null,
  "GET",
  403,
);
await request(
  `reports/catalog/guides?categoryId=${privateCat.id}`,
  reader.token,
  null,
  "GET",
  403,
);
await request(
  "reports/catalog/guides?role=AREA_ADMIN",
  admin.token,
  null,
  "GET",
  400,
);
await request(
  "reports/catalog/units?status=draft",
  admin.token,
  null,
  "GET",
  400,
);
await request(
  "reports/catalog/users?startDate=2026-10-16&endDate=2026-10-15",
  admin.token,
  null,
  "GET",
  400,
);
await request("reports/catalog/users?page=0", admin.token, null, "GET", 400);
await request("reports/catalog/unknown", admin.token, null, "GET", 400);
await request("reports/catalog/options", null, null, "GET", 401);
await mkdir(".cache/catalog-artifacts", { recursive: true });
for (const kind of ["units", "users", "guides"]) {
  for (const format of ["pdf", "xlsx", "csv"]) {
    const bytes = await request(
      `reports/catalog/${kind}/export/${format}`,
      admin.token,
    );
    check(
      Buffer.isBuffer(bytes) && bytes.length > 50,
      `${kind}: exportação ${format}`,
    );
    await writeFile(`.cache/catalog-artifacts/${kind}.${format}`, bytes);
    const upload = new FormData();
    upload.append("file", new Blob([bytes]), `${kind}.${format}`);
    const parsed = await request("documents/process", admin.token, upload);
    check(
      parsed.text.length > 0 && !parsed.text.includes("Segredo externo"),
      `${kind}/${format}: reabertura e isolamento`,
    );
  }
  await request(
    `reports/catalog/${kind}/export/csv?columns=password`,
    admin.token,
    null,
    "GET",
    400,
  );
}
const readerExport = await request(
  "reports/catalog/guides/export/csv",
  reader.token,
);
check(
  !readerExport.toString("utf8").includes("Rascunho"),
  "exportação do leitor não contém rascunhos",
);
sql(`UPDATE users SET "UnitId"='${u2.id}' WHERE "Id"='${branch.id}'`);
const freshBranchToken = await login(branch.email);
check(
  (await report("guides", freshBranchToken)).total === 0,
  "vínculo da unidade anterior não libera orientações",
);
console.log(
  `APROVADO: ${checks} verificações de relatórios de unidades, usuários e orientações.`,
);
