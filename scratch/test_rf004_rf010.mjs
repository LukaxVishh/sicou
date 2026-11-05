// RF-004 (perfil Desenvolvedor) e RF-010 (transferência de usuários) contra uma API e um banco ISOLADOS.
// Cria os próprios dados sintéticos; não envia e-mails. Recusa bancos cujo nome não indique teste.
//
// Variáveis (padrões entre parênteses):
//   SICOU_TEST_API_BASE      (http://localhost:5195/api/)
//   SICOU_TEST_DB_CONTAINER  (sicou-rf010-db)   container Docker do PostgreSQL de teste
//   SICOU_TEST_DB            (sicou_rf010)      nome do banco de teste
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

const base = process.env.SICOU_TEST_API_BASE ?? "http://localhost:5195/api/";
const container = process.env.SICOU_TEST_DB_CONTAINER ?? "sicou-rf010-db";
const database = process.env.SICOU_TEST_DB ?? "sicou_rf010";
assert.match(database, /^(sicou_rf010|.*_test.*)$/, "Use somente um banco de teste isolado.");

const sql = (text) =>
  execFileSync("docker", ["exec", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", text], {
    encoding: "utf8",
  }).trim();

const suffix = randomBytes(5).toString("hex");
const password = "Rf!" + randomBytes(12).toString("hex");
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log("OK " + label);
}

async function request(path, token, body, method = body ? "POST" : "GET", expected = [200, 201, 204]) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert.ok(allowed.includes(response.status), `${method} ${path}: esperado ${allowed.join("/")}, recebido ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const login = async (email) => (await request("auth/login", null, { email, password })).accessToken;
const userIdByEmail = (email) => sql(`SELECT "Id" FROM users WHERE "Email"='${email}'`);

// ---------- Preparação: Super Admin, empresas, unidades e setor com Workflows ----------
const superEmail = `rf-super-${suffix}@example.test`;
await request("auth/register", null, { fullName: "Super RF", email: superEmail, password });
sql(`INSERT INTO user_roles ("UserId","RoleId") SELECT u."Id", r."Id" FROM users u CROSS JOIN roles r WHERE u."Email"='${superEmail}' AND r."Name"='SUPER_ADMIN'`);
const superToken = await login(superEmail);

check(sql(`SELECT count(*) FROM roles WHERE "Name"='DEVELOPER'`) === "1", "RF-004: perfil DEVELOPER criado na inicialização");

const c1 = await request("companies", superToken, { name: `Empresa RF A ${suffix}` });
const c2 = await request("companies", superToken, { name: `Empresa RF B ${suffix}` });
const u1 = await request(`companies/${c1.id}/units`, superToken, { name: `Unidade Norte ${suffix}`, code: `N${suffix}`.slice(0, 10) });
const u2 = await request(`companies/${c1.id}/units`, superToken, { name: `Unidade Sul ${suffix}`, code: `S${suffix}`.slice(0, 10) });
const area = await request(`companies/${c1.id}/areas`, superToken, { name: `Operações ${suffix}`, moduleCodes: [3] });

// ---------- RF-004: Desenvolvedor com os poderes do Super Admin ----------
const devEmail = `rf-dev-${suffix}@example.test`;
await request("users", superToken, { fullName: "Dev RF", email: devEmail, password, companyId: null, unitId: null, roles: ["DEVELOPER"] });
const devToken = await login(devEmail);
const devCompanies = await request("companies", devToken);
check(devCompanies.some((c) => c.id === c1.id) && devCompanies.some((c) => c.id === c2.id), "RF-004: Desenvolvedor lista empresas de toda a plataforma");
const devCompany = await request("companies", devToken, { name: `Empresa criada pelo Dev ${suffix}` });
check(Boolean(devCompany?.id), "RF-004: Desenvolvedor executa operação exclusiva da plataforma (criar empresa)");
const devUsers = await request("users", devToken);
check(devUsers.some((u) => u.email === superEmail), "RF-004: Desenvolvedor lista usuários de toda a plataforma");

const adminEmail = `rf-admin-${suffix}@example.test`;
await request("users", superToken, { fullName: "Admin Empresa RF", email: adminEmail, password, companyId: c1.id, unitId: null, roles: ["COMPANY_ADMIN"] });
const adminToken = await login(adminEmail);
await request("users", adminToken, { fullName: "Tentativa", email: `rf-x-${suffix}@example.test`, password, companyId: c1.id, unitId: null, roles: ["DEVELOPER"] }, "POST", 403);
check(true, "RF-004: Admin da Empresa não concede o perfil Desenvolvedor na criação");
const adminCompanies = await request("companies", adminToken);
check(adminCompanies.length === 1 && adminCompanies[0].id === c1.id, "RF-004: Admin da Empresa continua restrito à própria empresa");

// ---------- RF-010: preparação do usuário, acesso, árvore e processo ----------
const xEmail = `rf-unit-${suffix}@example.test`;
const x = await request("users", superToken, { fullName: "Usuário Unidade RF", email: xEmail, password, companyId: c1.id, unitId: u1.id, roles: ["UNIT_USER"] });
await request("user-area-accesses", superToken, { userId: x.id, companyId: c1.id, unitId: u1.id, areaId: area.id, canView: true, canHandleWorkflowRequests: true });
check(true, "Pré-condição: acesso de X na Unidade Norte configurado");

const node = (code, name, nodeType) => request(`areas/${area.id}/process-nodes`, superToken, { code: `${code}_${suffix}`, name, nodeType });
const n0 = await node("ini", "Confecção", 1);
const n1 = await node("ana", "Análise", 2);
const n2 = await node("fim", "Arquivo", 4);
const tree = await request(`areas/${area.id}/process-types`, superToken, { code: `RF-${suffix}`.slice(0, 20), name: `Solicitação RF ${suffix}`, description: "Teste RF-010", targetAudience: 1, startNodeId: n0.id });
await request(`process-types/${tree.id}`, superToken, {
  name: tree.name, description: tree.description, targetAudience: 1, startNodeId: n0.id,
  nodes: [{ processNodeId: n0.id, order: 1 }, { processNodeId: n1.id, order: 2 }, { processNodeId: n2.id, order: 3 }],
  fields: [],
  transitions: [
    { fromNodeId: n0.id, toNodeId: n1.id, allowAdvance: true, allowReturn: true, allowRestart: true },
    { fromNodeId: n1.id, toNodeId: n2.id, allowAdvance: true, allowReturn: true, allowRestart: true },
  ],
}, "PUT");
await request(`process-types/${tree.id}/homologate`, superToken, {});
await request(`users/${x.id}/process-nodes`, superToken, { processNodeIds: [n0.id, n1.id] }, "PUT");

let xToken = await login(xEmail);
const p1 = await request("processes", xToken, { processTypeId: tree.id, title: "Rascunho antes da transferência", isDraft: true });
await request(`processes/${p1.id}/draft`, xToken, { title: "Editado pelo autor", fieldValues: {} }, "PUT");
check(true, "Pré-condição: autor edita o próprio rascunho antes da transferência");

const updateX = (unitId, companyId, copy) => request(`users/${x.id}`, superToken,
  { fullName: "Usuário Unidade RF", email: xEmail, companyId, unitId, isActive: true, copyAccessesToNewUnit: copy }, "PUT");
const activeAccesses = () => sql(`SELECT count(*) FROM user_area_accesses WHERE "UserId"='${x.id}' AND "IsActive"`);
const activeNodes = () => sql(`SELECT count(*) FROM user_process_nodes WHERE "UserId"='${x.id}' AND "IsActive"`);

// ---------- Transferência 1: Norte → Sul, sem cópia ----------
await updateX(u2.id, c1.id, false);
check(activeAccesses() === "0", "RF-010: sem cópia, acessos da unidade anterior são desativados");
check(activeNodes() === "0", "RF-010: sem cópia, locais de processo atribuídos são removidos");
let transfers = await request(`users/${x.id}/transfers`, superToken);
check(transfers.length === 1 && transfers[0].fromUnitName === u1.name && transfers[0].toUnitName === u2.name
  && transfers[0].revokedAreaAccesses === 1 && transfers[0].copiedAreaAccesses === 0 && transfers[0].revokedProcessNodes === 2
  && transfers[0].performedByName === "Super RF", "RF-010: transferência registrada com origem, destino, responsável e contagens");
await request("processes/my", xToken, null, "GET", 401);
check(true, "RF-010: sessão aberta antes da transferência é invalidada");

xToken = await login(xEmail);
await request(`processes/${p1.id}`, xToken);
check(true, "RF-010: autor continua visualizando o processo antigo (acompanhamento)");
await request(`processes/${p1.id}/draft`, xToken, { title: "Tentativa após transferência", fieldValues: {} }, "PUT", 403);
check(true, "RF-010: autor transferido não edita/tramita o processo aberto antes da transferência");
check((await request("processes/my", xToken)).some((p) => p.id === p1.id), "RF-010: 'Meus processos' mantém o processo antigo na mesma empresa");

// ---------- Transferência 2: Sul → Norte, com cópia ----------
await request("user-area-accesses", superToken, { userId: x.id, companyId: c1.id, unitId: u2.id, areaId: area.id, canView: true, canManageWorkflows: true });
await request(`users/${x.id}/process-nodes`, superToken, { processNodeIds: [n0.id, n1.id] }, "PUT");
await updateX(u1.id, c1.id, true);
const copiedRow = sql(`SELECT "UnitId" || '|' || "CanView" || '|' || "CanManageWorkflows" || '|' || "CanHandleWorkflowRequests" FROM user_area_accesses WHERE "UserId"='${x.id}' AND "IsActive"`);
check(copiedRow === `${u1.id}|true|true|false`, "RF-010: com cópia, o acesso é recriado na nova unidade com as mesmas permissões");
check(sql(`SELECT count(*) FROM user_area_accesses WHERE "UserId"='${x.id}'`) === "2", "RF-010: a cópia reaproveita o vínculo inativo da unidade em vez de duplicar");
check(activeNodes() === "2", "RF-010: com cópia, os locais de processo são mantidos");
transfers = await request(`users/${x.id}/transfers`, superToken);
check(transfers.length === 2 && transfers[0].copyAccessesRequested && transfers[0].copiedAreaAccesses === 1 && transfers[0].revokedProcessNodes === 0,
  "RF-010: histórico registra a cópia, mais recente primeiro");

xToken = await login(xEmail);
await request(`processes/${p1.id}/draft`, xToken, { title: "Ainda bloqueado", fieldValues: {} }, "PUT", 403);
check(true, "RF-010: processo antigo continua bloqueado sem permissão de tramitação na nova lotação");
const p2 = await request("processes", xToken, { processTypeId: tree.id, title: "Rascunho depois da transferência", isDraft: true });
await request(`processes/${p2.id}/draft`, xToken, { title: "Autor atual edita", fieldValues: {} }, "PUT");
check(true, "RF-010: processo aberto depois da transferência segue a regra normal de autoria");

// ---------- Transferência 3: troca de empresa (cópia pedida é ignorada) ----------
await updateX(null, c2.id, true);
check(activeAccesses() === "0" && activeNodes() === "0", "RF-010: na troca de empresa nada é copiado e os locais são removidos");
transfers = await request(`users/${x.id}/transfers`, superToken);
check(transfers[0].fromCompanyName === c1.name && transfers[0].toCompanyName === c2.name && transfers[0].toUnitName === "Sede"
  && transfers[0].copiedAreaAccesses === 0, "RF-010: troca de empresa registrada com empresa de origem e destino");
xToken = await login(xEmail);
check(!(await request("processes/my", xToken)).some((p) => p.id === p1.id || p.id === p2.id), "RF-010: 'Meus processos' não lista processos da empresa anterior");
await request(`processes/${p1.id}`, xToken, null, "GET", 403);
check(true, "RF-010: processo da empresa anterior não é visível depois da troca de empresa");
await request(`users/${x.id}/transfers`, adminToken, null, "GET", 403);
check(true, "RF-010: Admin da empresa anterior não consulta o histórico de quem saiu da empresa");

console.log(`\n${checks} verificações aprovadas.`);
