// Requires Playwright + Chromium. Start Vite with VITE_API_BASE_URL=http://127.0.0.1:5189
// and port 5188, then run: node scratch/test_integrations_ui.cjs
// API responses are mocked; the HTTP suite validates the real API separately.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR', error.message); });
    const user = { id: 'test-user', fullName: 'Teste UI', email: 'ui@example.test', companyId: null, unitId: null, roles: [process.env.SICOU_UI_ROLE || 'SUPER_ADMIN'], isActive: true, mustChangePassword: false };
    await page.addInitScript(user => {
      localStorage.setItem('sicou.accessToken', 'ui-test-session');
      localStorage.setItem('sicou.expiresAt', new Date(Date.now() + 3600000).toISOString());
      localStorage.setItem('sicou.user', JSON.stringify(user));
    }, user);
    const tokens = [];
    const automations = [];
    const alerts = [];
    let creates = 0, revocations = 0;
    await page.route('http://127.0.0.1:5189/api/**', async route => {
      const path = new URL(route.request().url()).pathname.toLowerCase();
      const method = route.request().method();
      let body = [];
      if (path === '/api/auth/me') body = user;
      else if (path === '/api/notifications') body = { items: [], unreadCount: 0, totalCount: 0 };
      else if (path === '/api/automations' && method === 'POST') {
        const request = route.request().postDataJSON();
        assert.equal(request.name, 'Rotina financeira');
        body = { ...request, id: 'test-automation', userId: user.id, isActive: true };
        automations.push(body);
        alerts.push({ id: 'test-alert', automationId: body.id, kind: 'Failure', message: 'Execução terminou com falha.', createdAt: new Date().toISOString(), acknowledgedAt: null });
      }
      else if (path === '/api/automations') body = { automations, summary: { running: 0, succeeded: 1, failed: 1, unacknowledgedAlerts: alerts.filter(a => !a.acknowledgedAt).length }, alerts };
      else if (path === '/api/automations/test-automation/runs') body = { total: 1, items: [{ id: 'test-run', status: 'Succeeded', host: 'test-host', startedAt: new Date().toISOString(), durationMs: 1500, message: 'Comando finalizado.', exitCode: 0 }] };
      else if (path === '/api/automations/test-automation' && method === 'PUT') { automations[0] = { ...automations[0], ...route.request().postDataJSON() }; body = automations[0]; }
      else if (path === '/api/automations/alerts/test-alert/acknowledge') { alerts[0].acknowledgedAt = new Date().toISOString(); await route.fulfill({ status: 204 }); return; }
      else if (path === '/api/integrations/scopes') body = ['processes:read', 'posts:create'];
      else if (path === '/api/integrations/calls') body = { total: 0, items: [], lastSevenDays: { calls: 0, errors: 0 } };
      else if (path === '/api/integrations/tokens' && method === 'POST') {
        const request = route.request().postDataJSON();
        assert.equal(request.name, 'Teste automação');
        assert.deepEqual(request.scopes, ['processes:read']);
        const token = { id: 'test-token', name: request.name, scopes: 'processes:read', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), revokedAt: null };
        tokens.push(token); creates++;
        body = { ...token, token: 'sic_ui_test_one_time_secret' };
      } else if (path === '/api/integrations/tokens') body = tokens;
      else if (path === '/api/integrations/tokens/test-token' && method === 'DELETE') {
        tokens[0].revokedAt = new Date().toISOString(); revocations++;
        await route.fulfill({ status: 204 }); return;
      }
      await route.fulfill({ status: 200, json: body });
    });
    await page.goto(process.env.SICOU_FRONTEND_URL || 'http://127.0.0.1:5188/app/integrations');
    await page.getByRole('heading', { name: 'Integrações', exact: true }).waitFor({ timeout: 10000 });
    await page.getByRole('link', { name: 'Integrações', exact: true }).waitFor();
    await page.getByLabel('Consultar processos e árvores').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Criar token', exact: true }).isDisabled(), true);
    await page.getByLabel('Nome da integração').fill('Teste automação');
    await page.getByLabel('Consultar processos e árvores').check();
    await page.getByRole('button', { name: 'Criar token', exact: true }).click();
    await page.getByText('sic_ui_test_one_time_secret', { exact: true }).waitFor();
    assert.equal(creates, 1);
    await page.getByRole('button', { name: 'Já guardei, ocultar token' }).click();
    assert.equal(await page.getByText('sic_ui_test_one_time_secret', { exact: true }).count(), 0);
    await page.reload();
    await page.getByRole('button', { name: 'Revogar', exact: true }).waitFor();
    assert.equal(await page.getByText('sic_ui_test_one_time_secret', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Revogar', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Revogar', exact: true }).click();
    await page.getByText('Revogado', { exact: true }).waitFor();
    assert.equal(revocations, 1);
    await page.getByRole('heading', { name: 'Execuções das automações' }).waitFor();
    await page.locator('summary').filter({ hasText: 'Cadastrar automação' }).click();
    await page.getByLabel('Nome da automação', { exact: true }).fill('Rotina financeira');
    await page.getByRole('button', { name: 'Cadastrar automação', exact: true }).click();
    await page.getByRole('button', { name: 'Ver execuções de Rotina financeira' }).click();
    await page.getByText('Comando finalizado. (código 0)', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reconhecer alerta', exact: true }).click();
    await page.getByText('Reconhecido', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
    await page.getByText('Pausada', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('main').parentElement).paddingLeft === '0px');
    const workspace = page.locator('main > div').first();
    assert.equal(await workspace.evaluate(element => element.scrollWidth > element.clientWidth), false);
    assert.deepEqual(errors, []);
    console.log('PASS: tokens, one-time secret, automation registration, history, alert acknowledgement, pause, mobile content width, no JS errors (mocked API).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
