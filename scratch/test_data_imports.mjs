// Synthetic fixtures in the isolated reports_test_* database only. No email.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const base = 'http://localhost:5185/api/';
const database = (await readFile('.cache/reports-test-db.txt', 'utf8')).replace(/^\uFEFF/, '').trim();
assert.match(database, /^reports_test_[a-f0-9]+$/);
const sql = text => execFileSync('C:/Program Files/PostgreSQL/17/bin/psql.exe', ['-h','127.0.0.1','-p','55439','-U','guide_test','-d',database,'-v','ON_ERROR_STOP=1','-At','-c',text], { encoding:'utf8' }).trim();
const suffix = randomBytes(6).toString('hex'), password = 'Imp!' + randomBytes(14).toString('hex');
let checks = 0;
function check(value, label) { assert.ok(value, label); console.log('OK ' + label); checks++; }
async function request(path, token, body, method = body ? 'POST' : 'GET', expected = 200) {
  const response = await fetch(base + path, { method, headers:{ ...(token ? { Authorization:'Bearer '+token } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type':'application/json' } : {}) }, ...(body ? { body:body instanceof FormData ? body : JSON.stringify(body) } : {}) });
  assert.equal(response.status, expected, `${method} ${path}: ${response.status === expected ? '' : await response.text()}`);
  if (expected >= 400) { checks++; console.log('OK rejeicao '+expected+' '+path); return; }
  if (expected === 204) return;
  return response.headers.get('Content-Type')?.includes('json') ? response.json() : Buffer.from(await response.arrayBuffer());
}
const email = `import.super.${suffix}@example.test`;
await request('auth/register',null,{fullName:'Import Super',email,password});
sql(`INSERT INTO user_roles ("UserId","RoleId") SELECT u."Id",r."Id" FROM users u CROSS JOIN roles r WHERE u."Email"='${email}' AND r."Name"='SUPER_ADMIN'`);
const login = async (email, pass = password) => (await request('auth/login',null,{email,password:pass}));
const token = (await login(email)).accessToken;
const company = await request('companies',token,{name:'Imports '+suffix},'POST',201);
const foreign = await request('companies',token,{name:'Foreign Imports '+suffix},'POST',201);
const area = await request(`companies/${company.id}/areas`,token,{name:'Import area',moduleCodes:['Guide','Workflows']},'POST',201);
const otherArea = await request(`companies/${company.id}/areas`,token,{name:'Restricted area',moduleCodes:['Guide','Workflows']},'POST',201);
async function user(name, role, access) {
  const email = `import.${name}.${suffix}@example.test`;
  const u = await request('users',token,{fullName:name,email,password,roles:[role],companyId:company.id},'POST',201);
  if (access) await request('user-area-accesses',token,{userId:u.id,companyId:company.id,areaId:area.id,...access},'POST',201);
  return (await login(email)).accessToken;
}
const admin = await user('admin','COMPANY_ADMIN');
const reader = await user('reader','HEADQUARTER_USER',{canView:true});
const manager = await user('manager','AREA_ADMIN',{canManageWorkflows:true,canManageGuide:true});
const preview = (kind, text, actor = token, target = company.id, targetArea = null, expected = 200) => {
  const form = new FormData(); form.append('companyId',target); if (targetArea) form.append('areaId',targetArea);
  form.append('file',new Blob([typeof text === 'string' ? text : JSON.stringify(text)]),kind === 'workflows' ? 'workflow.json' : 'modelo.csv');
  return request(`imports/${kind}/preview`,actor,form,'POST',expected);
};
const confirm = (plan, actor = token, expected = 200) => request('imports/confirm',actor,{token:plan.token},'POST',expected);
const csvUnits = rows => 'nome;codigo;cidade;uf\n'+rows.join('\n');
await request('imports/options',null,null,'GET',401);
check((await request('imports/options',reader)).kinds.length === 0,'leitor sem importacoes');
const choices = await request('imports/options',manager);
check(choices.kinds.includes('workflows') && choices.kinds.includes('guides') && !choices.kinds.includes('users'),'gestor limitado aos modulos');
await request('imports/units/template/csv',reader,null,'GET',403);
await preview('units',csvUnits(['Nome;C;;']),admin,foreign.id,null,403);
await preview('units',csvUnits(['Nome;C;;']),reader,company.id,null,403);
for (const kind of ['units','users','guides']) for (const format of ['csv','xlsx']) {
  check((await request(`imports/${kind}/template/${format}`,token)).length > 10,`modelo ${kind} ${format}`);
}
const invalid = await preview('units',csvUnits(['Nome;DUP;;','Outro;dup;;']));
check(invalid.valid === 1 && !invalid.token && invalid.rows[1].errors.length,'duplicidade case insensitive impede confirmacao');
await preview('users','nome;email;perfil;senha\nTeste;a@example.test;SUPER_ADMIN;segredo',token,company.id,null,400);
let plan = await preview('units',csvUnits(['Unidade Um;U1;Curitiba;pr','Unidade Dois;U2;Toledo;PR']));
check(plan.valid === 2 && !!plan.token,'previa valida');
check(sql(`SELECT count(*) FROM units WHERE "CompanyId"='${company.id}'`) === '0','previa nao grava unidades');
await confirm(plan,admin,403);
check((await confirm(plan)).created === 2,'confirma lote de unidades');
await confirm(plan,token,400);
const units = await request(`companies/${company.id}/units`,token);
check(units.length === 2 && units.some(u=>u.code === 'U1' && u.state === 'PR'),'unidades disponiveis no cadastro');
plan = await preview('units',csvUnits(['Livre;FREE;;','Mudou;RACE;;']));
await request(`companies/${company.id}/units`,token,{name:'Outra',code:'RACE'},'POST',201);
await confirm(plan,token,400);
check(sql(`SELECT count(*) FROM units WHERE "CompanyId"='${company.id}' AND "Code"='FREE'`) === '0','duplicidade apos previa impede lote inteiro');
// Force a database failure on the second insert to prove actual transaction rollback.
const trigger = 'import_fail_'+suffix;
sql(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."CompanyId"='${company.id}' AND NEW."Code"='FAIL' THEN RAISE EXCEPTION 'Synthetic import failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${trigger} BEFORE INSERT ON units FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
try {
  plan = await preview('units',csvUnits(['Primeira;ROLLBACK;;','Falha;FAIL;;']));
  await confirm(plan,token,400);
  check(sql(`SELECT count(*) FROM units WHERE "CompanyId"='${company.id}' AND "Code"='ROLLBACK'`) === '0','falha real na segunda linha desfaz primeira gravacao');
} finally { sql(`DROP TRIGGER ${trigger} ON units; DROP FUNCTION ${trigger}()`); }
const usersHeader = 'nome;email;perfil;unidade_codigo\n';
check(!(await preview('users',usersHeader+`Proibido;forbid.${suffix}@example.test;SUPER_ADMIN;`)).token,'SUPER_ADMIN nao importavel');
check(!(await preview('users',usersHeader+`Proibido;company.${suffix}@example.test;COMPANY_ADMIN;`,admin)).token,'admin empresa nao eleva perfil para company admin');
check(!(await preview('users',usersHeader+`Invalido;unitbad.${suffix}@example.test;UNIT_USER;EXTERNA`)).token,'unidade inexistente rejeitada');
const importedEmail = `imported.hq.${suffix}@example.test`;
plan = await preview('users',usersHeader+`Pessoa Sede;${importedEmail};HEADQUARTER_USER;\nPessoa Unidade;imported.unit.${suffix}@example.test;UNIT_USER;U1`);
check(plan.valid === 2,'usuarios e vinculo de unidade validos');
const created = await confirm(plan);
check(created.created === 2 && created.credentials.length === 2 && created.credentials[0].temporaryPassword !== created.credentials[1].temporaryPassword,'senhas individuais retornadas somente apos gravacao');
check(sql(`SELECT count(*) FROM users WHERE "Email"='${importedEmail}' AND "MustChangePassword" AND "TemporaryPasswordExpiresAt">now()`) === '1','senha temporaria persistida com expiracao e troca obrigatoria');
const importedLogin = await login(importedEmail,created.credentials.find(c=>c.email === importedEmail).temporaryPassword);
check(!!importedLogin.accessToken,'usuario importado autentica com senha temporaria');
await request('imports/options',importedLogin.accessToken,null,'GET',403);
const guideCsv = 'titulo;categoria;conteudo;url;publicar\nGuia importado;Nova Categoria;Texto completo;;sim\nGuia rascunho;Nova Categoria;Texto rascunho;;nao';
await preview('guides',guideCsv,manager,company.id,otherArea.id,403);
plan = await preview('guides',guideCsv,manager,company.id,area.id);
check(plan.valid === 2 && plan.rows[0].warnings.length,'previa avisa criacao de categoria');
check((await confirm(plan,manager)).created === 2,'orientacoes importadas por gestor autorizado');
check(sql(`SELECT count(*) FROM guide_items WHERE "AreaId"='${area.id}'`) === '2','orientacoes gravadas no setor');
check(sql(`SELECT count(*) FROM guide_categories WHERE "AreaId"='${area.id}'`) === '1','categoria compartilhada sem duplicar');
const workflow = await request('imports/workflows/template/json',manager);
workflow.workflows[0].codigo = 'FLUXO';
await preview('workflows',workflow,manager,company.id,otherArea.id,403);
plan = await preview('workflows',workflow,manager,company.id,area.id);
check(plan.valid === 1 && plan.rows[0].values.etapas.includes('INICIO'),'workflow completo validado e exibido na previa');
check((await confirm(plan,manager)).created === 1,'workflow completo importado por gestor');
const types = await request(`areas/${area.id}/process-types`,token);
const tree = await request(`process-types/${types.find(t=>t.code === 'FLUXO').id}`,token);
check(tree.status === 'Draft' && tree.nodes.length === 3 && tree.fields.length === 1 && tree.transitions.length === 2,'rascunho contem etapas campos e transicoes');
check(tree.startNodeId && tree.fields[0].processNodeId === tree.startNodeId,'campo vinculado a etapa inicial');
check(!(await preview('workflows',workflow,manager,company.id,area.id)).token,'duplicidade de workflow rejeitada');
workflow.workflows[0].codigo = 'QUEBRADO'; workflow.workflows[0].transicoes[0].destino = 'NAO_EXISTE';
check(!(await preview('workflows',workflow,manager,company.id,area.id)).token,'transicao para etapa inexistente rejeitada');
console.log(`PASS ${checks} verificacoes de importacao; somente banco isolado.`);
