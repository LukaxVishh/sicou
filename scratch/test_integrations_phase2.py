"""Phase 2 scenarios, invoked by test_integration_tokens.py in its disposable environment."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
import subprocess
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading
import tempfile
from pathlib import Path


def run_phase2(request, sql, check, a, b, company_a, company_b, area_a, area_b, root, base):
    uid = a['user']['id']
    jwt = a['accessToken']
    sql(f'''INSERT INTO user_roles ("UserId", "RoleId") SELECT '{uid}', "Id" FROM roles WHERE "Name"='COMPANY_ADMIN';
        UPDATE users SET "CompanyId"='{company_b}' WHERE "Id"='{b['user']['id']}';
        INSERT INTO user_roles ("UserId", "RoleId") SELECT '{b['user']['id']}', "Id" FROM roles WHERE "Name"='COMPANY_ADMIN';''')

    def token(scopes):
        status, data, _ = request('POST', '/api/integrations/tokens', jwt, {'name': 'Phase 2', 'expiresInDays': 1, 'scopes': scopes})
        check(status == 201, 'phase 2 token created')
        return data['token']

    monitor = token(['automations:read', 'automations:write'])
    reader = token(['automations:read'])

    def definition(name='Test automation', interval=None):
        body = {'name': name, 'heartbeatTimeoutSeconds': 30, 'maxRunMinutes': 1, 'expectedIntervalMinutes': interval}
        status, data, _ = request('POST', '/api/automations', jwt, body)
        check(status == 201, 'automation definition created')
        return data

    automation = definition(interval=1)
    aid = automation['id']
    check(request('POST', '/api/automations', monitor, {'name': 'Not allowed'})[0] == 403, 'token cannot create automation definitions')
    check(request('POST', f'/api/automations/{aid}/runs', reader, {'externalId': str(uuid.uuid4()), 'host': 'test'})[0] == 403, 'read-only monitor scope cannot start run')
    check(request('GET', '/api/automations', b['accessToken'])[1]['automations'] == [], 'monitor dashboard isolated by company')
    check(request('GET', f'/api/automations/{aid}/runs', b['accessToken'])[0] == 404, 'another company cannot read run history')
    check(request('POST', f'/api/automations/{aid}/runs', monitor, {'externalId': str(uuid.UUID(int=0)), 'host': 'test'})[0] == 400, 'empty execution id rejected')

    start_body = {'externalId': str(uuid.uuid4()), 'host': 'test'}
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: request('POST', f'/api/automations/{aid}/runs', monitor, start_body), range(4)))
    check(sorted(r[0] for r in results) == [200, 200, 200, 201] and len({r[1]['id'] for r in results}) == 1, 'concurrent start retries create one execution')
    rid = results[0][1]['id']
    check(request('POST', f'/api/automations/{aid}/runs', monitor, {**start_body, 'host': 'different'})[0] == 409, 'idempotency key cannot change host')
    check(request('POST', f'/api/automations/runs/{rid}/heartbeat', monitor, {})[0] == 200, 'heartbeat accepted')
    check(request('POST', f'/api/automations/runs/{rid}/complete', monitor, {'succeeded': True, 'exitCode': 7})[0] == 400, 'conflicting success code rejected')
    check(request('POST', f'/api/automations/runs/{rid}/complete', monitor, {})[0] == 400, 'completion requires explicit succeeded value')
    completed = {'succeeded': True, 'exitCode': 0, 'message': 'Done'}
    first = request('POST', f'/api/automations/runs/{rid}/complete', monitor, completed)
    again = request('POST', f'/api/automations/runs/{rid}/complete', monitor, completed)
    check(first[0] == again[0] == 200 and first[1] == again[1] and first[1]['durationMs'] >= 0, 'completion retries preserve immutable result and duration')
    check(request('POST', f'/api/automations/runs/{rid}/heartbeat', monitor, {})[0] == 409, 'terminal run cannot be revived')
    check(request('POST', f'/api/automations/runs/{rid}/complete', monitor, {'succeeded': False})[0] == 409, 'terminal result cannot be changed')

    def start():
        status, run, _ = request('POST', f'/api/automations/{aid}/runs', monitor, {'externalId': str(uuid.uuid4()), 'host': 'test'})
        check(status == 201, 'new run started')
        return run['id']

    failed = start()
    failure = {'succeeded': False, 'exitCode': 2, 'message': 'Test failure'}
    request('POST', f'/api/automations/runs/{failed}/complete', monitor, failure)
    request('POST', f'/api/automations/runs/{failed}/complete', monitor, failure)
    check(sql(f'SELECT COUNT(*) FROM automation_alerts WHERE "RunId"=\'{failed}\';') == '1', 'failed completion retries create one alert')
    check(any('Automação' in n['title'] for n in request('GET', '/api/notifications', jwt)[1]['items']), 'failure produces in-app notification')

    def wait_for(predicate, label):
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            if predicate():
                check(True, label)
                return
            time.sleep(0.25)
        check(False, label)

    lost = start()
    sql(f'UPDATE automation_runs SET "LastHeartbeatAt"=NOW()-INTERVAL \'40 seconds\' WHERE "Id"=\'{lost}\';')
    wait_for(lambda: sql(f'SELECT "Status" FROM automation_runs WHERE "Id"=\'{lost}\';') == 'Interrupted', 'background monitor detects lost heartbeat')
    check(request('POST', f'/api/automations/runs/{lost}/complete', monitor, completed)[0] == 409, 'late completion cannot overwrite interruption')
    long = start()
    sql(f'UPDATE automation_runs SET "StartedAt"=NOW()-INTERVAL \'2 minutes\' WHERE "Id"=\'{long}\';')
    wait_for(lambda: sql(f'SELECT "Status" FROM automation_runs WHERE "Id"=\'{long}\';') == 'Interrupted', 'background monitor enforces maximum duration')
    sql(f'UPDATE automations SET "ScheduleBaselineAt"=NOW()-INTERVAL \'2 minutes\', "LastStartedAt"=NULL, "OverdueAlertedAt"=NULL WHERE "Id"=\'{aid}\';')
    wait_for(lambda: sql(f'SELECT COUNT(*) FROM automation_alerts WHERE "AutomationId"=\'{aid}\' AND "Kind"=\'Overdue\';') == '1', 'missed scheduled start produces alert')
    time.sleep(1.2)
    check(sql(f'SELECT COUNT(*) FROM automation_alerts WHERE "AutomationId"=\'{aid}\' AND "Kind"=\'Overdue\';') == '1', 'repeated scans do not duplicate overdue alerts')
    alert = request('GET', '/api/automations', jwt)[1]['alerts'][0]
    check(request('POST', f'/api/automations/alerts/{alert["id"]}/acknowledge', b['accessToken'], {})[0] == 404, 'another company cannot acknowledge alert')
    check(request('POST', f'/api/automations/alerts/{alert["id"]}/acknowledge', jwt, {})[0] == 204, 'owner acknowledges alert')
    check(request('GET', f'/api/automations/{aid}/runs?page=0', jwt)[0] == 400, 'run history pagination validated')
    check(request('GET', f'/api/automations/{aid}/runs?status=Invalid', jwt)[0] == 400, 'run history status validated')
    paused = {k: automation[k] for k in ('name', 'heartbeatTimeoutSeconds', 'maxRunMinutes', 'expectedIntervalMinutes')}
    check(request('PUT', f'/api/automations/{aid}', jwt, {**paused, 'isActive': False})[0] == 200, 'owner pauses automation')
    check(request('POST', f'/api/automations/{aid}/runs', monitor, {'externalId': str(uuid.uuid4())})[0] == 409, 'paused automation rejects new execution')
    check(request('POST', f'/api/automations/{aid}/runs', monitor, start_body)[1]['id'] == rid, 'paused automation retains idempotent start replay')
    request('PUT', f'/api/automations/{aid}', jwt, {**paused, 'isActive': True})

    agent_env = {**os.environ, 'SICOU_API_URL': base, 'SICOU_AUTOMATION_ID': aid, 'SICOU_INTEGRATION_TOKEN': monitor}
    for code in (0, 7):
        result = subprocess.run([sys.executable, str(root / 'agents/sicou_agent.py'), '--', sys.executable, '-c', f'raise SystemExit({code})'], env=agent_env, capture_output=True, timeout=30)
        latest = request('GET', f'/api/automations/{aid}/runs', jwt)[1]['items'][0]
        check(result.returncode == code and latest['status'] == ('Succeeded' if code == 0 else 'Failed'), f'real local agent reports exit code {code}')
        check(monitor.encode() not in result.stdout + result.stderr, 'agent output does not expose token')
    heartbeat = subprocess.run([sys.executable, str(root / 'agents/sicou_agent.py'), '--', sys.executable, '-c', 'import time; time.sleep(11)'], env=agent_env, capture_output=True, timeout=35)
    check(heartbeat.returncode == 0, 'agent runs long enough to send heartbeat')
    missing = subprocess.run([sys.executable, str(root / 'agents/sicou_agent.py'), '--', '/nonexistent/sicou-test-command'], env=agent_env, capture_output=True, timeout=30)
    latest = request('GET', f'/api/automations/{aid}/runs', jwt)[1]['items'][0]
    check(missing.returncode == 1 and latest['status'] == 'Failed', 'failed local launch does not leave running execution')

    # Simulate a gateway losing successful start/completion responses after commit.
    dropped = set()
    class Gateway(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            code, data, _ = request('POST', self.path, self.headers['Authorization'][7:], body)
            kind = 'start' if self.path.endswith('/runs') else 'complete' if self.path.endswith('/complete') else None
            if kind and kind not in dropped and code < 300:
                dropped.add(kind)
                code, data = 503, {'message': 'Gateway response lost after commit'}
            payload = json.dumps(data).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    with ThreadingHTTPServer(('127.0.0.1', 0), Gateway) as gateway:
        thread = threading.Thread(target=gateway.serve_forever, daemon=True)
        thread.start()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'executions.txt'
            retry_env = {**agent_env, 'SICOU_API_URL': f'http://127.0.0.1:{gateway.server_port}'}
            command = f'from pathlib import Path; p=Path({str(output)!r}); p.write_text(p.read_text()+"run\\n" if p.exists() else "run\\n")'
            result = subprocess.run([sys.executable, str(root / 'agents/sicou_agent.py'), '--', sys.executable, '-c', command], env=retry_env, capture_output=True, timeout=30)
            check(result.returncode == 0 and dropped == {'start', 'complete'} and output.read_text() == 'run\n', 'agent recovers lost responses without repeating command or execution')
        gateway.shutdown()
        thread.join()

    # Full workflow: realistic graph/fields in disposable DB, all operations over HTTP.
    def seed_tree(area, owner):
        tree, start_node, stage, end, initial, step = [str(uuid.uuid4()) for _ in range(6)]
        for node, kind in [(start_node, 1), (stage, 2), (end, 5)]:
            sql(f'''INSERT INTO process_nodes ("Id","AreaId","Code","Name","NodeType","CreatedAt","IsActive") VALUES ('{node}','{area}','{node}','Test node',{kind},NOW(),true);
                INSERT INTO user_process_nodes ("Id","UserId","ProcessNodeId","CreatedAt","IsActive") VALUES ('{uuid.uuid4()}','{owner}','{node}',NOW(),true);''')
        sql(f'''INSERT INTO process_types ("Id","AreaId","FamilyId","VersionNumber","Code","Name","TargetAudience","Status","StartNodeId","CreatedAt","IsActive") VALUES ('{tree}','{area}','{tree}',1,'TEST','Integration workflow',1,2,'{start_node}',NOW(),true);''')
        for index, node in enumerate((start_node, stage, end)):
            sql(f'''INSERT INTO process_type_nodes ("Id","ProcessTypeId","ProcessNodeId","Order","CreatedAt","IsActive") VALUES ('{uuid.uuid4()}','{tree}','{node}',{index},NOW(),true);''')
        for field, node in ((initial, start_node), (step, stage)):
            sql(f'''INSERT INTO field_definitions ("Id","AreaId","Code","Name","Type","CreatedAt","IsActive") VALUES ('{field}','{area}','{field}','Required text',1,NOW(),true);
                INSERT INTO process_type_fields ("Id","ProcessTypeId","ProcessNodeId","FieldDefinitionId","IsRequired","DisplayOrder","CreatedAt","IsActive") VALUES ('{uuid.uuid4()}','{tree}','{node}','{field}',true,1,NOW(),true);''')
        for origin, dest in ((start_node, stage), (stage, end)):
            sql(f'''INSERT INTO process_transitions ("Id","ProcessTypeId","FromNodeId","ToNodeId","AllowAdvance","AllowReturn","AllowRestart","CreatedAt","IsActive") VALUES ('{uuid.uuid4()}','{tree}','{origin}','{dest}',true,true,true,NOW(),true);''')
        return tree, start_node, stage, end, initial, step

    tree, start_node, stage, end, initial, step = seed_tree(area_a, uid)
    other_tree, *_ = seed_tree(area_b, b['user']['id'])
    workflow = token(['processes:read', 'processes:create', 'processes:write', 'processes:transfer', 'processes:cancel', 'reports:read'])
    _, foreign, _ = request('POST', '/api/integrations/tokens', b['accessToken'], {'name': 'Foreign workflow', 'expiresInDays': 1, 'scopes': ['processes:read', 'processes:write', 'automations:write']})
    foreign_token = foreign['token']
    check(request('POST', f'/api/automations/{aid}/runs', foreign_token, {'externalId': str(uuid.uuid4())})[0] == 404, 'another owner token cannot report execution')
    check(request('POST', '/api/processes', workflow, {'processTypeId': other_tree})[0] == 403, 'cannot open process from another company tree')
    sql(f'INSERT INTO user_roles ("UserId","RoleId") SELECT \'{uid}\',"Id" FROM roles WHERE "Name"=\'SUPER_ADMIN\';')
    status, global_process, _ = request('POST', '/api/processes', workflow, {'processTypeId': other_tree})
    check(status == 201 and sql(f'SELECT "CompanyId" FROM process_instances WHERE "Id"=\'{global_process["id"]}\';') == company_b, 'Super Admin creation preserves target tree company')
    sql(f'DELETE FROM user_roles WHERE "UserId"=\'{uid}\' AND "RoleId" IN (SELECT "Id" FROM roles WHERE "Name"=\'SUPER_ADMIN\');')
    check(request('POST', '/api/processes', workflow, {'processTypeId': tree, 'initialFieldValues': {step: 'foreign stage'}})[0] == 400, 'cannot fill fields from a later stage while creating')
    status, process, _ = request('POST', '/api/processes', workflow, {'processTypeId': tree, 'title': 'Token workflow'})
    check(status == 201 and process['status'] == 'Draft', 'token opens draft')
    pid = process['id']
    check(request('POST', f'/api/processes/{pid}/protocol', workflow, {})[0] == 400, 'protocol validates required initial field')
    check(request('PUT', f'/api/processes/{pid}/draft', workflow, {'fieldValues': {initial: 'Initial value'}})[0] == 200, 'token fills draft field')
    check(request('PUT', f'/api/processes/{pid}/draft', workflow, {'fieldValues': {step: 'Wrong step'}})[0] == 400, 'draft rejects fields from another stage')
    status, process, _ = request('POST', f'/api/processes/{pid}/protocol', workflow, {})
    check(status == 200 and process['currentNodeId'] == stage and process['status'] == 'InReview', 'token protocols and enters next stage')
    inbox = request('GET', f'/api/areas/{area_a}/processes', workflow)[1]
    check(any(p['id'] == pid for p in inbox), 'protocolled process appears in area inbox')
    unit = str(uuid.uuid4())
    sql(f'''INSERT INTO units ("Id","CompanyId","Name","Code","CreatedAt","IsActive") VALUES ('{unit}','{company_a}','Test unit','TU',NOW(),true);''')
    status, process, _ = request('POST', f'/api/processes/{pid}/transfer', workflow, {'destinationUnitId': unit, 'observations': 'Transfer via integration'})
    check(status == 200 and process['currentUnitId'] == unit, 'token transfers process to authorized unit')
    report = request('GET', f'/api/reports/processes?areaId={area_a}', workflow)
    check(report[0] == 200 and any(p['id'] == pid for p in report[1]['items']), 'process appears in scoped report')
    check(request('GET', f'/api/reports/processes/export/csv?areaId={area_a}', workflow)[0] == 200, 'token exports report')
    check(request('POST', f'/api/processes/{pid}/advance', workflow, {'targetNodeId': end})[0] == 400, 'advance validates required stage field')
    check(request('POST', f'/api/processes/{pid}/advance', workflow, {'targetNodeId': end, 'fieldValues': {initial: 'Changed old step', step: 'Stage value'}})[0] == 400, 'advance cannot overwrite previous-stage value')
    status, process, _ = request('POST', f'/api/processes/{pid}/advance', workflow, {'targetNodeId': end, 'fieldValues': {initial: 'Initial value', step: 'Stage value'}})
    check(status == 200 and process['status'] == 'Approved', 'token fills stage and completes approved workflow')
    check(request('POST', f'/api/processes/{pid}/cancel', workflow, {'reason': 'Should not cancel'})[0] == 400, 'completed workflow cannot be cancelled')

    for operation, body, method in [('protocol', {}, 'POST'), ('draft', {}, 'PUT'), ('transfer', {'destinationUnitId': unit, 'observations': 'Cross company'}, 'POST'), ('advance', {}, 'POST')]:
        check(request(method, f'/api/processes/{pid}/{operation}', foreign_token, body)[0] in (400, 403), f'another company cannot mutate process via {operation}')
    _, draft, _ = request('POST', '/api/processes', workflow, {'processTypeId': tree})
    draft_id = draft['id']
    check(request('POST', f'/api/processes/{draft_id}/protocol', foreign_token, {})[0] == 403, 'other company admin token cannot protocol draft')
    check(request('PUT', f'/api/processes/{draft_id}/draft', foreign_token, {})[0] == 403, 'other company admin token cannot edit draft')
    foreign_unit = str(uuid.uuid4())
    sql(f'''INSERT INTO units ("Id","CompanyId","Name","Code","CreatedAt","IsActive") VALUES ('{foreign_unit}','{company_b}','Foreign unit','FU',NOW(),true);''')
    check(request('POST', '/api/processes', workflow, {'processTypeId': tree, 'originUnitId': foreign_unit})[0] == 403, 'cannot open process with origin unit from another company')
    check(request('POST', f'/api/processes/{draft_id}/transfer', workflow, {'destinationUnitId': foreign_unit, 'observations': 'Invalid destination'})[0] == 404, 'transfer cannot target unit from another company')
    check(request('POST', f'/api/processes/{draft_id}/cancel', workflow, {'reason': 'Cancelled by integration'})[1]['status'] == 'AdministrativeCancellation', 'token cancels draft with reason')
    check(request('POST', f'/api/processes/{draft_id}/protocol', workflow, {})[0] == 400, 'cancelled process cannot be protocolled')

    # Company dashboards aggregate peers, but recording always requires ownership.
    sql(f'UPDATE users SET "CompanyId"=\'{company_a}\' WHERE "Id"=\'{b["user"]["id"]}\';')
    _, peer, _ = request('POST', '/api/automations', b['accessToken'], {'name': 'Peer automation'})
    dashboard = request('GET', '/api/automations', jwt)[1]
    check(any(d['id'] == peer['id'] for d in dashboard['automations']), 'company admin sees teammate monitoring')
    check(request('POST', f'/api/automations/{peer["id"]}/runs', monitor, {'externalId': str(uuid.uuid4())})[0] == 404, 'same-company admin cannot forge teammate run')
    sql(f'UPDATE users SET "CompanyId"=\'{company_b}\' WHERE "Id"=\'{b["user"]["id"]}\';')

    sql(f'INSERT INTO user_roles ("UserId","RoleId") SELECT \'{b["user"]["id"]}\',"Id" FROM roles WHERE "Name"=\'DEVELOPER\';')
    _, developer, _ = request('POST', '/api/integrations/tokens', b['accessToken'], {'name': 'Developer monitoring', 'expiresInDays': 1, 'scopes': ['automations:read', 'automations:write']})
    check(any(d['id'] == aid for d in request('GET', '/api/automations', developer['token'])[1]['automations']), 'Developer can monitor across companies like Super Admin')
    check(request('POST', f'/api/automations/{aid}/runs', developer['token'], {'externalId': str(uuid.uuid4())})[0] == 404, 'Developer cannot forge another owner execution')
    sql(f'DELETE FROM user_roles WHERE "UserId"=\'{b["user"]["id"]}\' AND "RoleId" IN (SELECT "Id" FROM roles WHERE "Name"=\'DEVELOPER\');')

    unit2 = str(uuid.uuid4())
    sql(f'''INSERT INTO units ("Id","CompanyId","Name","Code","CreatedAt","IsActive") VALUES ('{unit2}','{company_a}','Second unit','TU2',NOW(),true);
        DELETE FROM user_roles WHERE "UserId"='{uid}';
        INSERT INTO user_roles ("UserId","RoleId") SELECT '{uid}',"Id" FROM roles WHERE "Name"='UNIT_USER';
        UPDATE users SET "UnitId"='{unit2}' WHERE "Id"='{uid}';''')
    bound = token(['processes:read', 'processes:create'])
    check(request('GET', f'/api/processes/{pid}', bound)[0] == 200, 'creator retains follow-up visibility inside same company after unit transfer')
    check(any(p['id'] == pid for p in request('GET', '/api/processes/my', bound)[1]), 'my requests preserve same-company author follow-up after unit transfer')
    check(request('POST', '/api/processes', bound, {'processTypeId': tree, 'originUnitId': unit})[0] == 403, 'unit user cannot choose another origin unit')
    check(request('POST', '/api/processes', bound, {'processTypeId': tree})[0] == 201, 'unit user can open within current unit')
    sql(f'''UPDATE users SET "UnitId"=NULL,"CompanyId"='{company_b}' WHERE "Id"='{uid}';''')
    moved = token(['processes:read'])
    check(all(p['id'] != pid for p in request('GET', '/api/processes/my', moved)[1]), 'new company token cannot list former company requests')
    check(request('GET', f'/api/processes/{pid}', moved)[0] == 403, 'new company token cannot access former company detail')
    sql(f'''UPDATE users SET "CompanyId"='{company_a}' WHERE "Id"='{uid}';
        DELETE FROM user_roles WHERE "UserId"='{uid}';
        INSERT INTO user_roles ("UserId","RoleId") SELECT '{uid}',"Id" FROM roles WHERE "Name"='COMPANY_ADMIN';''')
