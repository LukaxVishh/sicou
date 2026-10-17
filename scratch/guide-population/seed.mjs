// Explicit, additive academic seed. Never executed during application startup.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const require = createRequire(process.env.SICOU_SEED_MODULE_ROOT
  ? resolve(process.env.SICOU_SEED_MODULE_ROOT, 'package.json') : import.meta.url);
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const base = process.env.SICOU_SEED_API || 'http://localhost:8080';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Carga restrita à API local de demonstração.');
const output = resolve('.cache/guide-population');
await mkdir(output, { recursive: true });
let credentials;
if (process.env.SICOU_SEED_EMAIL && process.env.SICOU_SEED_PASSWORD) {
  credentials = { email: process.env.SICOU_SEED_EMAIL, password: process.env.SICOU_SEED_PASSWORD };
} else credentials = JSON.parse((await readFile('.cache/guide-demo-credentials.json', 'utf8')).replace(/^\uFEFF/, ''));
let token;
async function api(path, data, method = data ? 'POST' : 'GET') {
  const multipart = data instanceof FormData;
  const response = await fetch(`${base}/api/${path}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: { ...(!multipart ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data ? { body: multipart ? data : JSON.stringify(data) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
token = (await api('auth/login', credentials)).accessToken;
const companyName = 'Empresa demonstração Orientador';
const areas = (await api('guide/areas')).filter(a => a.companyName === companyName && ['Operações', 'Recursos Humanos', 'Tecnologia'].includes(a.name));
assert.equal(areas.length, 3, 'Prepare os três setores na Empresa demonstração Orientador antes da carga. Nenhum cadastro foi alterado.');
const groups = [
  { name: 'Manuais e procedimentos', format: 'pdf', action: 'Procedimento', steps: ['Confira o contexto e identifique a unidade solicitante.', 'Reúna os dados relacionados ao assunto e descreva o resultado esperado.', 'Registre a solicitação no setor correto e acompanhe o histórico.', 'Confira a conclusão e registre eventuais ajustes para a próxima execução.'] },
  { name: 'Checklists', format: 'csv', action: 'Checklist', steps: ['Verifique cada item antes de encaminhar a solicitação.', 'Marque como pendente o que ainda precisa de informação.', 'Descreva a evidência ou observação junto do item.', 'Somente encaminhe após revisar as pendências com o responsável.'] },
  { name: 'Modelos e formulários', format: 'docx', action: 'Modelo', steps: ['Identifique solicitante, setor e unidade no formulário.', 'Preencha objetivo, descrição e informações de referência.', 'Revise campos vazios e remova dados pessoais desnecessários.', 'Submeta o pedido pelo fluxo correspondente no Sicou.'] },
  { name: 'Planilhas de controle', format: 'csv', action: 'Controle', steps: ['Registre uma linha por solicitação, sem duplicar o protocolo.', 'Informe responsável, situação e próxima ação.', 'Atualize o controle quando houver movimentação no processo.', 'Use a planilha como apoio; o histórico oficial permanece no Sicou.'] },
  { name: 'Perguntas frequentes', format: null, action: 'Dúvidas', steps: ['Onde registrar? Escolha o setor e o fluxo relacionados ao assunto.', 'O que informar? Descreva contexto, objetivo e dados disponíveis.', 'Como acompanhar? Consulte o processo e seu histórico no Sicou.', 'Se faltar informação? Registre a pendência e solicite complemento ao responsável.'] },
  { name: 'Guias rápidos', format: 'pdf', action: 'Guia rápido', steps: ['Localize o procedimento relacionado antes de iniciar.', 'Separe as informações mínimas para evitar retrabalho.', 'Execute as etapas na ordem e registre o que foi realizado.', 'Confira o resultado e encaminhe dúvidas ao gestor do setor.'] },
];
const topics = {
  'Operações': [
    ['Abertura de solicitações', 'Triagem de demandas', 'Transferência entre unidades', 'Encerramento de atendimento'],
    ['Conferência de documentos', 'Preparação de atendimento', 'Revisão de pendências', 'Entrega de materiais'],
    ['Registro de ocorrência', 'Solicitação de material', 'Relato de visita técnica', 'Passagem de turno'],
    ['Demandas da unidade', 'Estoque de materiais', 'Agenda de atendimentos', 'Pendências operacionais'],
    ['Devolução para correção', 'Localização de protocolos', 'Anexos em solicitações', 'Responsável pelo atendimento'],
    ['Busca de orientações', 'Consulta do histórico', 'Registro de observações', 'Conferência antes do envio'],
  ],
  'Recursos Humanos': [
    ['Integração de colaboradores', 'Atualização cadastral', 'Solicitação de férias', 'Solicitação de treinamento'],
    ['Documentação de integração', 'Conferência cadastral', 'Preparação de férias', 'Organização de treinamento'],
    ['Solicitação de declaração', 'Atualização de contato', 'Inscrição em treinamento', 'Registro de integração'],
    ['Participação em treinamentos', 'Agenda de integração', 'Solicitações ao RH', 'Entrega de documentos'],
    ['Acompanhamento de solicitações', 'Correção de cadastro', 'Envio de documentos ao RH', 'Dúvidas sobre treinamentos'],
    ['Primeiro acesso ao Sicou', 'Abertura de pedido ao RH', 'Consulta de orientações do RH', 'Revisão de anexos'],
  ],
  'Tecnologia': [
    ['Abertura de chamado técnico', 'Solicitação de acesso', 'Registro de falha de sistema', 'Preparação de equipamento'],
    ['Informações para o suporte', 'Conferência de acesso', 'Entrega de equipamento', 'Retorno de manutenção'],
    ['Solicitação de perfil', 'Relato de incidente técnico', 'Termo de entrega de equipamento', 'Registro de manutenção'],
    ['Inventário de equipamentos', 'Chamados em acompanhamento', 'Solicitações de acesso', 'Agenda de manutenção'],
    ['Chamado devolvido', 'Recuperação de acesso ao Sicou', 'Anexos para o suporte', 'Acompanhamento de falhas'],
    ['Descrição de um erro', 'Consulta de chamado', 'Conferência de permissões', 'Revisão de atendimento técnico'],
  ],
};
const notes = {
  'Operações': 'Identifique unidade, local do atendimento e protocolo relacionado. Em transferências, confira a unidade de destino e registre o motivo.',
  'Recursos Humanos': 'Utilize dados fictícios nos testes. Não inclua documentos pessoais reais; este material não define políticas trabalhistas ou regras da instituição.',
  'Tecnologia': 'Informe sistema, mensagem de erro e passos para reproduzir. Nunca inclua senhas, tokens ou chaves nos chamados e capturas.',
};
const disclaimer = 'EXEMPLO ACADÊMICO - Dados fictícios. Adapte o conteúdo às regras aprovadas pela instituição antes de uso operacional.';
function linesFor(area, group, topic) {
  return [disclaimer, `Setor: ${area.name}`, `Assunto: ${topic}`, '', ...group.steps.map((s, i) => `${i + 1}. ${s}`), '', notes[area.name], '', 'Resultado esperado: solicitação compreensível, documentos revisados e acompanhamento registrado no Sicou.'];
}
async function makeAttachment(area, group, topic, lines) {
  if (group.format === 'csv') {
    const cell = value => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [['Sicou - exemplo acadêmico', area.name, topic, ''], ['Item', 'Descrição', 'Situação', 'Observação'], ...group.steps.map((s, i) => [i + 1, s, 'Pendente', 'Preencher durante a demonstração'])];
    return Buffer.from('\uFEFF' + rows.map(r => r.map(cell).join(';')).join('\r\n'), 'utf8');
  }
  if (group.format === 'docx') return Packer.toBuffer(new Document({
    creator: 'Sicou - demonstração acadêmica', title: topic,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 160 } } } } },
    sections: [{ properties: {}, children: [new Paragraph({ text: topic, heading: HeadingLevel.TITLE }), ...lines.filter(Boolean).map(line => new Paragraph({ children: [new TextRun(line)] })), new Paragraph({ text: 'Preenchimento', heading: HeadingLevel.HEADING_1 }), ...['Solicitante: ____________________', 'Unidade: ____________________', 'Descrição do pedido: ____________________', 'Referência no Sicou: ____________________'].map(text => new Paragraph(text))] }],
  }));
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 760, width: 596, height: 82, color: rgb(0.98, 0.94, 0.84) });
  page.drawText('SICOU | ORIENTADOR', { x: 42, y: 800, size: 12, font: bold, color: rgb(0.6, 0.35, 0.05) });
  page.drawText(area.name, { x: 42, y: 777, size: 12, font });
  let y = 725;
  function drawWrapped(text, size, face) {
    let current = '';
    for (const word of text.split(' ')) {
      if (face.widthOfTextAtSize(`${current} ${word}`, size) > 500 && current) {
        page.drawText(current, { x: 42, y, size, font: face }); y -= size + 6; current = word;
      } else current = current ? `${current} ${word}` : word;
    }
    if (current) { page.drawText(current, { x: 42, y, size, font: face }); y -= size + 6; }
    y -= 6;
  }
  drawWrapped(topic, 19, bold);
  for (const line of lines.filter(Boolean)) drawWrapped(line, 10, font);
  assert.ok(y > 65, 'Conteúdo PDF excede a página.');
  page.drawText('Material de demonstração | Consulte o gestor do setor | 1 / 1', { x: 42, y: 35, size: 9, font });
  return Buffer.from(await pdf.save());
}
const summary = { areas: [], createdCategories: 0, createdItems: 0, attachedFiles: 0, preservedItems: 0 };
for (const area of areas) {
  const path = `areas/${area.id}/guide`;
  let guide = await api(path);
  assert.ok(guide.canManage, 'A conta precisa gerenciar o Orientador.');
  const expected = [];
  for (const [g, group] of groups.entries()) {
    let category = guide.categories.find(c => c.name === group.name);
    if (!category) { category = await api(`${path}/categories`, { name: group.name, sortOrder: g + 10 }); summary.createdCategories++; }
    for (const [i, topic] of topics[area.name][g].entries()) {
      const title = `${group.action}: ${topic}`;
      const lines = linesFor(area, group, topic);
      let item = guide.items.find(item => item.title === title);
      if (!item) {
        item = await api(`${path}/items`, { categoryId: category.id, title, content: lines.join('\n'), sortOrder: i + 1, isPublished: !(g === 5 && i >= 2) });
        summary.createdItems++;
      } else summary.preservedItems++;
      // Resume an interrupted upload only when the untouched seed content matches.
      if (group.format && !item.fileName && item.content === lines.join('\n')) {
          const bytes = await makeAttachment(area, group, topic, lines);
          const filename = `${area.name}-${g + 1}-${i + 1}.${group.format}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '-').toLowerCase();
          await writeFile(join(output, filename), bytes);
          const form = new FormData();
          form.append('file', new Blob([bytes]), filename);
          await api(`${path}/items/${item.id}/file`, form);
          summary.attachedFiles++;
      }
      expected.push(title);
    }
  }
  guide = await api(path);
  assert.ok(expected.every(title => guide.items.some(item => item.title === title)));
  const seeded = guide.items.filter(item => expected.includes(item.title));
  const files = seeded.filter(item => item.fileName);
  for (const item of files) {
    const response = await fetch(`${base}/api/${path}/items/${item.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  summary.areas.push({ name: area.name, orientations: seeded.length, published: seeded.filter(i => i.isPublished).length, attachments: files.length, types: groups.length });
  console.log(`${area.name}: ${seeded.length} orientações; ${files.length} anexos verificados.`);
}
await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
