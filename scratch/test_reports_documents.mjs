// Run against an isolated development database. Never target production.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const base = process.env.SICOU_REPORT_TEST_URL || "http://localhost:5185";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname) &&
    new URL(base).port === "5185",
  "Use somente a API local de testes na porta 5185.",
);
const database = (await readFile(".cache/reports-test-db.txt", "utf8"))
  .replace(/^\uFEFF/, "")
  .trim();
assert.match(database, /^reports_test_[a-f0-9]+$/);
const suffix = randomBytes(5).toString("hex");
const password = "Rpt!" + randomBytes(12).toString("hex");
let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks++;
  console.log("OK " + label);
};
async function request(
  path,
  token,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
) {
  const response = await fetch(base + "/api/" + path, {
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
    `${method} ${path}: ${await (response.status === expected ? Promise.resolve("") : response.text())}`,
  );
  if (expected === 204) return;
  return response.headers.get("Content-Type")?.includes("application/json")
    ? response.json()
    : Buffer.from(await response.arrayBuffer());
}
async function login(email) {
  return (await request("auth/login", null, { email, password })).accessToken;
}
const email = `reports.super.${suffix}@example.test`;
await request("auth/register", null, {
  fullName: "Reports Super",
  email,
  password,
});
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
    "-c",
    `INSERT INTO user_roles ("UserId", "RoleId") SELECT u."Id", r."Id" FROM users u CROSS JOIN roles r WHERE u."Email" = '${email}' AND r."Name" = 'SUPER_ADMIN'`,
  ],
  { stdio: "pipe" },
);
const superToken = await login(email);
const baselineTotal = (await request("reports/processes", superToken)).total;
async function company(name) {
  return request(
    "companies",
    superToken,
    { name: `Reports test ${suffix} ${name}` },
    "POST",
    201,
  );
}
async function area(companyId, name) {
  return request(
    `companies/${companyId}/areas`,
    superToken,
    { name, moduleCodes: ["Workflows"] },
    "POST",
    201,
  );
}
async function unit(companyId, name) {
  return request(
    `companies/${companyId}/units`,
    superToken,
    { name, code: name },
    "POST",
    201,
  );
}
async function user(companyId, unitId, role, name, accessArea, manage = false) {
  const email = `reports.${name}.${suffix}@example.test`;
  const created = await request(
    "users",
    superToken,
    { fullName: name, email, password, companyId, unitId, roles: [role] },
    "POST",
    201,
  );
  if (accessArea)
    await request(
      "user-area-accesses",
      superToken,
      {
        userId: created.id,
        companyId,
        unitId,
        areaId: accessArea,
        canView: true,
        canManage: manage,
        canHandleWorkflowRequests: manage,
      },
      "POST",
      201,
    );
  return { ...created, token: await login(email) };
}
const a = await company("A"),
  b = await company("B");
const a1 = await area(a.id, "Operações"),
  a2 = await area(a.id, "Financeiro"),
  b1 = await area(b.id, "Operações externas");
const u1 = await unit(a.id, "Unidade A1"),
  u2 = await unit(a.id, "Unidade A2");
const admin = await user(a.id, null, "COMPANY_ADMIN", "admin");
const manager = await user(a.id, null, "AREA_ADMIN", "manager", a1.id, true);
const reader = await user(a.id, null, "HEADQUARTER_USER", "reader", a1.id);
const branch = await user(a.id, u1.id, "UNIT_USER", "branch", a1.id, true);
const outsider = await user(b.id, null, "COMPANY_ADMIN", "outsider");
const noAccess = await user(a.id, null, "HEADQUARTER_USER", "noaccess");
async function tree(areaId) {
  const node = await request(
    `areas/${areaId}/process-nodes`,
    superToken,
    { code: "START", name: "Início", nodeType: 1 },
    "POST",
    201,
  );
  return request(
    `areas/${areaId}/process-types`,
    superToken,
    {
      code: "REPORTS",
      name: "Solicitação",
      startNodeId: node.id,
      targetAudience: 1,
    },
    "POST",
    201,
  );
}
const t1 = await tree(a1.id),
  t2 = await tree(a2.id),
  t3 = await tree(b1.id);
async function processRow(typeId, originUnitId, title, isDraft = false) {
  return request(
    "processes",
    superToken,
    { processTypeId: typeId, originUnitId, title, isDraft },
    "POST",
    201,
  );
}
const p1 = await processRow(t1.id, u1.id, "=Teste; São João e férias");
const p2 = await processRow(t1.id, u2.id, "Outra unidade", true);
const p3 = await processRow(t2.id, u1.id, "Outro setor");
const p4 = await processRow(t3.id, null, "Segredo de outra empresa");
const p5 = await processRow(t1.id, null, "Processo da sede");
const report = (token, query = "") =>
  request("reports/processes?" + query, token);
check(
  (await report(superToken)).total === baselineTotal + 5,
  "super admin vê as duas empresas",
);
check((await report(admin.token)).total === 4, "admin vê somente sua empresa");
check(
  (await report(manager.token)).total === 3,
  "gestor vê apenas setor permitido",
);
check(
  (await report(branch.token)).total === 1,
  "usuário da unidade não vê sede nem outra unidade",
);
check(
  (await report(noAccess.token)).total === 0,
  "usuário sem acesso não obtém processos",
);
check(
  (await report(admin.token, `areaId=${a1.id}&unitId=${u1.id}&status=InReview`))
    .items[0].id === p1.id,
  "combinação de setor, unidade e status",
);
check(
  (await report(admin.token, "status=Draft")).items[0].id === p2.id,
  "filtro de status rascunho",
);
check(
  (await report(admin.token, "startDate=2000-01-01&endDate=2000-01-01"))
    .total === 0,
  "período sem dados retorna vazio",
);
const today = new Date().toISOString().slice(0, 10);
check(
  (await report(admin.token, `startDate=${today}&endDate=${today}`)).total ===
    4,
  "período inclui todo o dia UTC",
);
await request(
  `reports/processes?companyId=${b.id}`,
  admin.token,
  null,
  "GET",
  403,
);
checks++;
await request(
  `reports/processes?areaId=${a2.id}`,
  manager.token,
  null,
  "GET",
  403,
);
checks++;
await request(
  `reports/processes?unitId=${u2.id}`,
  branch.token,
  null,
  "GET",
  403,
);
checks++;
await request(
  "reports/processes?startDate=2026-10-16&endDate=2026-10-15",
  admin.token,
  null,
  "GET",
  400,
);
checks++;
await request("reports/processes?page=0", admin.token, null, "GET", 400);
checks++;
await request("reports/processes?status=99", admin.token, null, "GET", 400);
checks++;
await request("reports/processes", null, null, "GET", 401);
checks++;
const first = await report(admin.token, "page=1&pageSize=2"),
  second = await report(admin.token, "page=2&pageSize=2");
check(
  first.items.length === 2 &&
    second.items.length === 2 &&
    !first.items.some((x) => second.items.some((y) => y.id === x.id)),
  "paginação sem duplicatas",
);
const options = await request("reports/options", branch.token);
check(
  options.companies.length === 1 &&
    options.areas.length === 1 &&
    options.units.length === 1,
  "opções respeitam empresa, setor e unidade",
);
await request(
  `reports/processes/${p1.id}/responsible`,
  reader.token,
  { userId: manager.id },
  "PUT",
  403,
);
checks++;
await request(
  `reports/processes/${p4.id}/responsible`,
  admin.token,
  { userId: admin.id },
  "PUT",
  404,
);
checks++;
await request(
  `reports/processes/${p1.id}/responsible`,
  admin.token,
  { userId: outsider.id },
  "PUT",
  400,
);
checks++;
await request(
  `reports/processes/${p1.id}/responsible`,
  admin.token,
  { userId: reader.id },
  "PUT",
  400,
);
checks++;
const assignOptions = await request(
  `reports/processes/${p1.id}/responsible-options`,
  manager.token,
);
check(
  assignOptions.some((x) => x.id === manager.id) &&
    !assignOptions.some((x) => x.id === reader.id || x.id === outsider.id),
  "candidatos à atribuição têm permissão operacional",
);
await request(
  `reports/processes/${p1.id}/responsible`,
  manager.token,
  { userId: manager.id },
  "PUT",
  204,
);
check(
  (await report(admin.token, `responsibleUserId=${manager.id}`)).items[0].id ===
    p1.id,
  "atribuição persistida e filtro de responsável",
);
check(
  (await report(branch.token, `responsibleUserId=${manager.id}`)).total === 1,
  "usuário de unidade filtra pelo responsável da sede sem ampliar seu escopo",
);
check(
  (await report(admin.token, "unassignedOnly=true")).total === 3,
  "filtro sem responsável",
);
const detail = await request("processes/" + p1.id, superToken);
check(
  detail.responsibleUserId === manager.id &&
    detail.history.some((h) =>
      h.observations?.includes("Responsável alterado"),
    ),
  "atribuição disponível no processo e registrada no histórico",
);
const destination = ".cache/report-artifacts";
await mkdir(destination, { recursive: true });
for (const format of ["pdf", "xlsx", "csv"]) {
  const path = `reports/processes/export/${format}?areaId=${a1.id}&columns=number,title,area,unit,status,responsible,createdAt`;
  const bytes = await request(path, manager.token);
  check(
    Buffer.isBuffer(bytes) && bytes.length > 100,
    `exportação ${format} gera arquivo`,
  );
  await writeFile(`${destination}/relatorio.${format}`, bytes);
  const upload = new FormData();
  upload.append("file", new Blob([bytes]), "relatorio." + format);
  const parsed = await request("documents/process", manager.token, upload);
  check(
    parsed.format === format.toUpperCase() &&
      parsed.text.includes("Operações") &&
      !parsed.text.includes("Segredo de outra empresa"),
    `${format} reaberto: acentos, conteúdo e isolamento`,
  );
  if (format === "csv")
    check(
      parsed.tables[0].rows.some((row) =>
        row.some((c) => c.startsWith("'=Teste")),
      ),
      "CSV neutraliza fórmula",
    );
  if (format === "xlsx")
    check(
      parsed.tables[0].rows[0].length === 7,
      "XLSX preserva seleção de sete colunas",
    );
  await request(
    `reports/processes/export/${format}?areaId=${b1.id}`,
    admin.token,
    null,
    "GET",
    403,
  );
  checks++;
}
await request(
  "reports/processes/export/csv?columns=password",
  admin.token,
  null,
  "GET",
  400,
);
checks++;
await request("reports/processes/export/exe", admin.token, null, "GET", 400);
checks++;
const csvUpload = new FormData();
csvUpload.append(
  "file",
  new Blob(['Nome;Mensagem\r\nJoão;"Linha 1\nLinha 2"']),
  "entrada.csv",
);
const csvParsed = await request("documents/process", branch.token, csvUpload);
check(
  csvParsed.tables[0].rows[1][1].includes("\n"),
  "upload CSV com conteúdo multilinha",
);
const bad = new FormData();
bad.append("file", new Blob(["texto"]), "arquivo.pdf");
await request("documents/process", reader.token, bad, "POST", 400);
checks++;
const forbidden = new FormData();
forbidden.append("file", new Blob(["texto"]), "script.exe");
await request("documents/process", reader.token, forbidden, "POST", 400);
checks++;
await request("documents/process", null, csvUpload, "POST", 401);
checks++;
const transferred = await request(`processes/${p1.id}/transfer`, superToken, {
  destinationUnitId: u2.id,
  observations: "Transferência para validar integração com relatórios",
});
check(
  transferred.responsibleUserId === manager.id &&
    transferred.originUnitId === u1.id &&
    transferred.currentUnitId === u2.id &&
    transferred.openedAt &&
    transferred.openedByUserId,
  "transferência preserva responsável, origem e metadados de abertura",
);
const cancelled = await request(`processes/${p1.id}/cancel`, superToken, {
  reason: "Cancelamento para validar integração com relatórios",
});
check(
  cancelled.status === "AdministrativeCancellation" && cancelled.responsibleUserId === manager.id &&
    cancelled.canManipulate === false,
  "cancelamento preserva responsável e bloqueia tramitação",
);
const searchResults = await request(`processes/search?areaId=${a1.id}`, superToken);
const searchItem = searchResults.find((item) => item.id === p1.id);
check(
  searchItem?.responsibleUserId === manager.id && searchItem.currentUnitId === u2.id &&
    searchItem.openedAt,
  "localizador da main preserva responsável e novos metadados",
);
const cancelledReport = await report(admin.token, "status=AdministrativeCancellation");
check(
  cancelledReport.total === 1 && cancelledReport.items[0].id === p1.id &&
    cancelledReport.items[0].status === "Cancelado administrativamente",
  "novo status da main disponível no filtro e no relatório",
);
const cancelledCsv = await request(
  "reports/processes/export/csv?status=AdministrativeCancellation&columns=number,status,responsible",
  admin.token,
);
check(
  cancelledCsv.toString("utf8").includes("Cancelado administrativamente") &&
    cancelledCsv.toString("utf8").includes("manager"),
  "exportação de cancelados preserva status e responsável",
);
console.log(
  `APROVADO: ${checks} verificações HTTP. Banco isolado; artefatos em ${destination}.`,
);
