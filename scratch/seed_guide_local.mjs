import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const baseUrl = 'http://localhost:8080';
const password = process.env.SICOU_LOCAL_PASSWORD ?? 'Local123!';
const adminEmail = 'admin.local@example.test';
const docker = process.env.SICOU_DOCKER_PATH ?? 'docker';
const workspace = fileURLToPath(new URL('../', import.meta.url));

async function request(path, method = 'GET', data, token, expected = 200) {
  const multipart = data instanceof FormData;
  const response = await fetch(baseUrl + path, {
    method,
    headers: { ...(multipart ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data === undefined ? undefined : multipart ? data : JSON.stringify(data),
  });
  if (response.status !== expected) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  if (expected === 204) return;
  return response.json();
}

async function login(email) {
  return (await request('/api/auth/login', 'POST', { email, password })).accessToken;
}

let token;
try { token = await login(adminEmail); }
catch {
  await request('/api/auth/register', 'POST', { fullName: 'Administrador Local', email: adminEmail, password });
}
const sql = `INSERT INTO user_roles ("UserId", "RoleId")
SELECT u."Id", r."Id" FROM users u CROSS JOIN roles r
WHERE u."Email" = '${adminEmail}' AND r."Name" = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;`;
const result = spawnSync(docker, ['compose', 'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'sicou-dev'],
  { cwd: workspace, input: sql, encoding: 'utf8' });
if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr);
token = await login(adminEmail);

async function ensure(path, name, data) {
  const found = (await request(path, 'GET', undefined, token)).find(value => value.name === name);
  return found ?? request(path, 'POST', { name, ...data }, token, 201);
}

const company = await ensure('/api/companies', 'Sicou - Demonstração Local', {});
const unit = await ensure(`/api/companies/${company.id}/units`, 'Unidade de Testes', { code: 'LOCAL01', city: 'Curitiba', state: 'PR' });
const area = await ensure(`/api/companies/${company.id}/areas`, 'Orientador - Testes', {
  description: 'Ambiente local para testar orientações e permissões.', moduleCodes: ['Guide', 'Informatives', 'Workflows'],
});
const users = await request('/api/users', 'GET', undefined, token);
const accesses = await request(`/api/user-area-accesses/by-company/${company.id}`, 'GET', undefined, token);
for (const [email, fullName, role, manage] of [
  ['gestor.local@example.test', 'Gestor Local', 'HEADQUARTER_USER', true],
  ['leitor.local@example.test', 'Leitor Local', 'UNIT_USER', false],
]) {
  const user = users.find(value => value.email === email) ?? await request('/api/users', 'POST', {
    fullName, email, password, companyId: company.id, unitId: manage ? null : unit.id, roles: [role],
  }, token, 201);
  if (!accesses.some(value => value.userId === user.id && value.areaId === area.id)) {
    await request('/api/user-area-accesses', 'POST', { userId: user.id, companyId: company.id,
      unitId: manage ? null : unit.id, areaId: area.id, canView: true, canManageGuide: manage }, token, 201);
  }
}
const path = `/api/areas/${area.id}/guide`;
let guide = await request(path, 'GET', undefined, token);
async function category(name, sortOrder) {
  return guide.categories.find(value => value.name === name) ?? request(`${path}/categories`, 'POST', { name, sortOrder }, token, 201);
}
const procedures = await category('Procedimentos', 0);
const references = await category('Materiais de apoio', 1);
for (const item of [
  { categoryId: procedures.id, title: 'Primeiros passos no Orientador', content: '1. Selecione a área.\n2. Busque uma orientação ou filtre por categoria.\n3. Consulte as instruções e baixe o anexo.\n4. Entre como gestor para criar, editar e publicar.', sortOrder: 0, isPublished: true },
  { categoryId: procedures.id, title: 'Procedimento em revisão', content: 'Rascunho para testar edição e publicação. Disponível apenas para gestores.', sortOrder: 1, isPublished: false },
  { categoryId: references.id, title: 'Checklist de atendimento', content: 'Confira a solicitação, consulte o procedimento da área e registre a conclusão. O anexo contém um checklist de exemplo.', sortOrder: 2, isPublished: true },
]) {
  if (!guide.items.some(value => value.title === item.title)) await request(`${path}/items`, 'POST', item, token, 201);
}
guide = await request(path, 'GET', undefined, token);
const checklist = guide.items.find(value => value.title === 'Checklist de atendimento');
const fileContent = 'Checklist local\n[ ] Conferir solicitação\n[ ] Consultar orientação\n[ ] Registrar conclusão\n';
if (!checklist.fileName) {
  const form = new FormData();
  form.append('file', new Blob([fileContent], { type: 'text/plain' }), 'checklist-local.txt');
  await request(`${path}/items/${checklist.id}/file`, 'POST', form, token, 204);
}

const manager = await login('gestor.local@example.test');
const reader = await login('leitor.local@example.test');
const managed = await request(path, 'GET', undefined, manager);
const read = await request(path, 'GET', undefined, reader);
assert.equal(managed.canManage, true);
assert.equal(read.canManage, false);
assert.ok(managed.items.some(item => !item.isPublished));
assert.ok(read.items.length > 0 && read.items.every(item => item.isPublished));
await request(`${path}/categories`, 'POST', { name: 'Escrita sem permissão', sortOrder: 0 }, reader, 403);
const draft = managed.items.find(item => !item.isPublished);
await request(`${path}/items/${draft.id}/file`, 'GET', undefined, reader, 404);
const fileResponse = await fetch(`${baseUrl}${path}/items/${checklist.id}/file`, { headers: { Authorization: `Bearer ${reader}` } });
assert.equal(fileResponse.status, 200);
assert.ok((await fileResponse.text()).includes('Checklist local'));
assert.ok((await request('/api/guide/areas', 'GET', undefined, reader)).some(value => value.id === area.id));
assert.equal((await fetch('http://localhost:3000')).status, 200);
assert.equal((await fetch(`${baseUrl}/swagger/index.html`)).status, 200);
console.log('Base local pronta: empresa, unidade, área, 3 usuários, 2 categorias, 3 orientações e anexo.');
console.log('Verificações aprovadas: frontend, API, login, áreas, gestor, leitor, rascunhos, bloqueio de escrita e download.');
console.log(`Área: ${area.id}`);
