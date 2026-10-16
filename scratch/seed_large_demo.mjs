// Local demonstration only. Preserves existing records and never sends email.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const base = 'http://localhost:5175';
const psql = process.env.SICOU_SEED_PSQL || 'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const credentialPath = '.cache/large-demo-credentials.json';
const quantity = Number(process.env.SICOU_SEED_PER_AREA || 600);
assert.ok(Number.isInteger(quantity) && quantity >= 6 && quantity <= 2000, 'Use 6 a 2.000 processos por setor.');
await mkdir('.cache', { recursive: true });
const parse = text => JSON.parse(text.replace(/^\uFEFF/, ''));
const superCredentials = parse(await readFile('.cache/guide-demo-credentials.json', 'utf8'));
let previous;
try { previous = parse(await readFile(credentialPath, 'utf8')); } catch (err) { if (err.code !== 'ENOENT') throw err; }
const password = previous?.password || process.env.SICOU_SEED_PASSWORD || 'Demo!' + randomBytes(8).toString('hex') + 'Aa1';
const accounts = previous?.accounts || [];
let token;
function sql(query) {
  return execFileSync(psql, ['-h', '127.0.0.1', '-p', '55439', '-U', 'guide_test', '-d', 'guide_test', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).trim();
}
async function api(path, body, method = body ? 'POST' : 'GET', auth = token) {
  const response = await fetch(base + '/api/' + path, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
const session = await api('auth/login', superCredentials, 'POST', null);
assert.ok(session.user.roles.includes('SUPER_ADMIN'));
token = session.accessToken;
assert.equal(sql('SELECT current_database()'), 'guide_test');
assert.equal(sql(`SELECT count(*) FROM users WHERE "Id"='${session.user.id}'::uuid`), '1', 'A API deve apontar para o mesmo banco local.');
const existingCompanies = await api('companies');
const allUsers = await api('users');
async function saveCredentials() { await writeFile(credentialPath, JSON.stringify({ password, accounts }, null, 2)); }
async function ensureUser(companyId, unitId, fullName, email, role) {
  let user = allUsers.find(u => u.email === email);
  if (!user) {
    user = await api('users', { fullName, email, password, companyId, unitId, roles: [role] });
    allUsers.push(user);
    accounts.push({ email, role, companyId, unitId, fullName });
    await saveCredentials();
  }
  assert.equal(user.companyId, companyId, 'Conta de demonstração já existe em outra empresa.');
  return user;
}
async function grant(user, areaId, manage, handle) {
  const existing = await api('user-area-accesses/by-user/' + user.id);
  if (!existing.some(x => x.areaId === areaId && x.isActive))
    await api('user-area-accesses', { userId: user.id, companyId: user.companyId, unitId: user.unitId, areaId, canView: true, canManage: manage, canPublishInformatives: manage, canManageGuide: manage, canManageWorkflows: manage, canHandleWorkflowRequests: handle });
}
const companyNames = ['Empresa demonstração Orientador', 'Cooperativa Horizonte — Demonstração', 'Grupo Nova Rota — Demonstração'];
const sectors = [
  { key: 'financeiro', name: 'Financeiro', types: ['Reembolso de despesas', 'Solicitação de pagamento'] },
  { key: 'rh', name: 'Recursos Humanos', types: ['Solicitação de férias', 'Atualização cadastral'] },
  { key: 'juridico', name: 'Jurídico', types: ['Análise de contrato', 'Consulta jurídica'] },
  { key: 'ti', name: 'Tecnologia', types: ['Suporte técnico', 'Liberação de acesso'] },
];
const contexts = [];
for (let companyIndex = 0; companyIndex < companyNames.length; companyIndex++) {
  const name = companyNames[companyIndex];
  const company = existingCompanies.find(c => c.name === name) || await api('companies', { name });
  const code = 'demo' + (companyIndex + 1);
  await ensureUser(company.id, null, `Administrador ${companyIndex + 1} · Demonstração`, `${code}.admin@example.test`, 'COMPANY_ADMIN');
  const existingUnits = await api(`companies/${company.id}/units`);
  const units = [];
  const cities = ['Cascavel', 'Toledo', 'Foz do Iguaçu', 'Curitiba', 'Londrina'];
  for (let i = 0; i < 5; i++) {
    const unitCode = `DEMO-${companyIndex + 1}-${i + 1}`;
    const unit = existingUnits.find(u => u.code === unitCode) || await api(`companies/${company.id}/units`, { name: `Unidade ${cities[i]} · Demo ${companyIndex + 1}`, code: unitCode, city: cities[i], state: 'PR' });
    const user = await ensureUser(company.id, unit.id, `Operador ${cities[i]} · Demo ${companyIndex + 1}`, `${code}.unidade${i + 1}@example.test`, 'UNIT_USER');
    units.push({ ...unit, user });
  }
  // Existing demonstration logins also receive data in their own company.
  if (companyIndex === 0) {
    const originalUnitUser = allUsers.find(u => u.email === 'usuario.unidade@example.test');
    if (originalUnitUser?.unitId) {
      const originalUnit = existingUnits.find(u => u.id === originalUnitUser.unitId);
      if (originalUnit) units.push({ ...originalUnit, user: originalUnitUser });
    }
  }
  const existingAreas = await api(`companies/${company.id}/areas`);
  for (const sector of sectors) {
    const area = existingAreas.find(a => a.name === sector.name) || await api(`companies/${company.id}/areas`, { name: sector.name, description: 'Setor com massa sintética para testes funcionais e relatórios.', moduleCodes: ['Workflows', 'Guide', 'Informatives'] });
    const manager = await ensureUser(company.id, null, `Gestor ${sector.name} · Demo ${companyIndex + 1}`, `${code}.${sector.key}.gestor@example.test`, 'AREA_ADMIN');
    const analyst = await ensureUser(company.id, null, `Analista ${sector.name} · Demo ${companyIndex + 1}`, `${code}.${sector.key}.analista@example.test`, 'HEADQUARTER_USER');
    await grant(manager, area.id, true, true); await grant(analyst, area.id, false, true);
    for (const unit of units) await grant(unit.user, area.id, false, false);
    if (companyIndex === 0) {
      const originalManager = allUsers.find(u => u.email === 'gestor.area@example.test');
      const originalAnalyst = allUsers.find(u => u.email === 'analista.sede@example.test');
      if (originalManager) await grant(originalManager, area.id, true, true);
      if (originalAnalyst) await grant(originalAnalyst, area.id, false, true);
    }
    const nodeDefs = [['CONFECCAO', 'Confecção', 1], ['TRIAGEM', 'Triagem', 2], ['APROVACAO', 'Aprovação', 3], ['CONCLUSAO', 'Conclusão', 4]];
    const existingNodes = await api(`areas/${area.id}/process-nodes`);
    const nodes = [];
    for (const [key, name, nodeType] of nodeDefs)
      nodes.push(existingNodes.find(n => n.code.toLowerCase() === ('DEMO-' + key).toLowerCase()) || await api(`areas/${area.id}/process-nodes`, { code: 'DEMO-' + key, name, nodeType }));
    const fieldDefs = [
      { code: 'DEMO-DESCRICAO', name: 'Descrição da solicitação', type: 2 },
      { code: 'DEMO-VALOR', name: 'Valor previsto', type: 4 },
      { code: 'DEMO-DATA', name: 'Data de referência', type: 7 },
      { code: 'DEMO-PRIORIDADE', name: 'Prioridade', type: 8, globalOptionsJson: JSON.stringify(['Baixa', 'Normal', 'Alta', 'Urgente']) },
    ];
    const existingFields = await api(`areas/${area.id}/fields`);
    const fields = [];
    for (const definition of fieldDefs) fields.push(existingFields.find(f => f.code.toLowerCase() === definition.code.toLowerCase()) || await api(`areas/${area.id}/fields`, definition));
    const existingTypes = await api(`areas/${area.id}/process-types`);
    const types = [];
    for (let i = 0; i < sector.types.length; i++) {
      const typeCode = `DEMO-${sector.key.toUpperCase()}-${i + 1}`;
      let type = existingTypes.find(t => t.code.toLowerCase() === typeCode.toLowerCase()) || await api(`areas/${area.id}/process-types`, { code: typeCode, name: sector.types[i], description: 'Fluxo de demonstração para testar processos e relatórios.', startNodeId: nodes[0].id, targetAudience: 1 });
      if (type.status === 'Draft' || type.status === 1) {
        type = await api('process-types/' + type.id, { name: sector.types[i], description: 'Fluxo de demonstração para testes.', startNodeId: nodes[0].id, targetAudience: 1,
          nodes: nodes.map((n, index) => ({ processNodeId: n.id, order: index + 1, instructions: 'Etapa de demonstração. Confira os dados e prossiga.' })),
          fields: fields.map((f, index) => ({ fieldDefinitionId: f.id, processNodeId: nodes[0].id, isRequired: index === 0, displayOrder: index + 1 })),
          transitions: nodes.slice(0, -1).map((n, index) => ({ fromNodeId: n.id, toNodeId: nodes[index + 1].id, allowAdvance: true, allowReturn: index > 0, allowRestart: true })) }, 'PUT');
        await api(`process-types/${type.id}/homologate`, {}, 'POST');
      }
      types.push(type);
    }
    const guide = await api(`areas/${area.id}/guide`);
    if (!guide.categories?.some(c => c.name === 'Procedimentos de demonstração')) {
      const category = await api(`areas/${area.id}/guide/categories`, { name: 'Procedimentos de demonstração', sortOrder: 1 });
      for (let i = 0; i < 3; i++) await api(`areas/${area.id}/guide/items`, { categoryId: category.id, title: `${sector.name}: ${['Como abrir uma solicitação', 'Documentos necessários', 'Revisão do procedimento'][i]}`, content: `Conteúdo fictício de demonstração do setor ${sector.name}.\n\n1. Confira os dados do solicitante.\n2. Preencha os campos obrigatórios.\n3. Acompanhe o andamento no sistema.`, isPublished: i < 2, sortOrder: i + 1 });
    }
    contexts.push({ company: company.id, area: area.id, sector: sector.name, types: types.map(t => t.id), typeNames: sector.types, nodes: nodes.map(n => n.id), fields: fields.map(f => f.id), units: units.map(u => u.id), unitUsers: units.map(u => u.user.id), unitNames: units.map(u => u.user.fullName), manager: manager.id, managerName: manager.fullName, analyst: analyst.id, analystName: analyst.fullName });
    console.log(`Estrutura pronta: ${company.name} / ${sector.name}`);
  }
}
await saveCredentials();
const payload = JSON.stringify(contexts).replaceAll("'", "''");
const statement = `BEGIN;
SELECT pg_advisory_xact_lock(715102026);
CREATE TEMP TABLE demo_context AS SELECT value AS c FROM jsonb_array_elements('${payload}'::jsonb);
CREATE TEMP TABLE demo_rows AS
SELECT md5('sicou-demo-v1:'||(c->>'area')||':'||n)::uuid AS id, c, n,
  (1+abs(hashtext('status:'||(c->>'area')||n)::bigint)%6)::int AS status,
  (abs(hashtext('unit:'||(c->>'area')||n)::bigint)%(jsonb_array_length(c->'units')+1))::int AS unitidx,
  (abs(hashtext('type:'||(c->>'area')||n)::bigint)%2)::int AS typeidx,
  (abs(hashtext('owner:'||(c->>'area')||n)::bigint)%5)::int AS owneridx,
  date_trunc('day',now())-(abs(hashtext('date:'||(c->>'area')||n)::bigint)%180)*interval '1 day'+(n%9)*interval '1 hour' AS created
FROM demo_context CROSS JOIN generate_series(1,${quantity}) n;
INSERT INTO process_instances ("Id","CompanyId","AreaId","ProcessTypeId","CurrentNodeId","ProcessNumber","Title","Status","CreatedByUserId","CreatedByUserName","ResponsibleUserId","OriginUnitId","CreatedAt","UpdatedAt","IsActive")
SELECT id,(c->>'company')::uuid,(c->>'area')::uuid,(c->'types'->>typeidx)::uuid,
 (c->'nodes'->>(CASE WHEN status IN(1,3) THEN 0 WHEN status=2 THEN 1 WHEN status IN(4,5) THEN 2 ELSE 3 END))::uuid,
 'DEMO26-'||upper(substr(replace(c->>'area','-',''),1,8))||'-'||lpad(n::text,5,'0'),
 (c->'typeNames'->>typeidx)||' · Demonstração #'||n,status,
 CASE WHEN unitidx=0 THEN c->>'analyst' ELSE c->'unitUsers'->>(unitidx-1) END,
 CASE WHEN unitidx=0 THEN c->>'analystName' ELSE c->'unitNames'->>(unitidx-1) END,
 CASE WHEN owneridx=0 THEN NULL WHEN owneridx IN(1,2) THEN (c->>'manager')::uuid ELSE (c->>'analyst')::uuid END,
 CASE WHEN unitidx=0 THEN NULL ELSE (c->'units'->>(unitidx-1))::uuid END,created,
 CASE WHEN status=1 THEN NULL ELSE least(now(),created+interval '2 hours'*(n%36+1)) END,true
FROM demo_rows ON CONFLICT ("Id") DO NOTHING;
INSERT INTO process_field_values ("Id","ProcessInstanceId","FieldDefinitionId","Value","CreatedAt","UpdatedAt","IsActive")
SELECT md5('demo-field:'||r.id||':'||f)::uuid,r.id,(c->'fields'->>f)::uuid,
 CASE f WHEN 0 THEN 'Massa sintética para testes. Setor: '||(c->>'sector')||'. Solicitação '||n||'.'
 WHEN 1 THEN ((10000+n*137)%500000/100.0)::numeric(10,2)::text
 WHEN 2 THEN to_char(created,'YYYY-MM-DD') ELSE (ARRAY['Baixa','Normal','Alta','Urgente'])[1+(n%4)] END,
 created,NULL,true FROM demo_rows r CROSS JOIN generate_series(0,3) f ON CONFLICT ("Id") DO NOTHING;
INSERT INTO process_histories ("Id","ProcessInstanceId","FromNodeId","ToNodeId","Action","UserId","UserFullName","Observations","CreatedAt","UpdatedAt","IsActive")
SELECT md5('demo-history:'||r.id||':'||h)::uuid,r.id,
 CASE WHEN h=0 THEN NULL ELSE (c->'nodes'->>(h-1))::uuid END,
 (c->'nodes'->>(CASE WHEN h=2 AND status=3 THEN 0 ELSE h END))::uuid,
 CASE WHEN h=2 AND status=3 THEN 2 WHEN h=0 AND status=1 THEN 4 WHEN h=2 AND status=5 THEN 4 ELSE 1 END,
 CASE WHEN h=0 THEN p."CreatedByUserId" ELSE c->>'manager' END,
 CASE WHEN h=0 THEN p."CreatedByUserName" ELSE c->>'managerName' END,
 'Histórico sintético de demonstração: '||(CASE WHEN h=0 THEN 'abertura' WHEN h=1 THEN 'triagem' WHEN h=2 AND status=3 THEN 'devolução para correção' WHEN h=2 AND status=5 THEN 'rejeição simulada' WHEN h=2 THEN 'aprovação simulada' ELSE 'conclusão simulada' END)||'. Não representa operação real.',
 least(now(),r.created+h*interval '2 hours'),NULL,true
FROM demo_rows r JOIN process_instances p ON p."Id"=r.id
CROSS JOIN generate_series(0,3) h WHERE h=0 OR (h=1 AND status<>1) OR (h=2 AND status IN(3,4,5,6)) OR (h=3 AND status=6)
ON CONFLICT ("Id") DO NOTHING;
COMMIT;
SELECT json_build_object('processos_demo',(SELECT count(*) FROM process_instances WHERE "ProcessNumber" LIKE 'DEMO26-%'),
 'historicos_demo',(SELECT count(*) FROM process_histories h JOIN process_instances p ON p."Id"=h."ProcessInstanceId" WHERE p."ProcessNumber" LIKE 'DEMO26-%'),
 'campos_demo',(SELECT count(*) FROM process_field_values f JOIN process_instances p ON p."Id"=f."ProcessInstanceId" WHERE p."ProcessNumber" LIKE 'DEMO26-%'));
`;
await writeFile('.cache/large-demo-seed.sql', statement);
console.log(execFileSync(psql, ['-h','127.0.0.1','-p','55439','-U','guide_test','-d','guide_test','-v','ON_ERROR_STOP=1','-f','.cache/large-demo-seed.sql'], { encoding:'utf8', maxBuffer: 4*1024*1024 }));
for (const account of accounts.filter(a => a.role === 'COMPANY_ADMIN')) {
  const auth = await api('auth/login', { email: account.email, password }, 'POST', null);
  const report = await api('reports/processes', null, 'GET', auth.accessToken);
  assert.equal(report.total, quantity*4, 'Admin deve ver somente os processos da própria empresa.');
}
console.log('População concluída. Credenciais locais em '+credentialPath+' (não versionado).');
