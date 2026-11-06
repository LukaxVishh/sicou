"""HTTP regression against a disposable PostgreSQL + API. Requires Docker and .NET 8.
Run from the repository root: python3 scratch/test_integration_tokens.py
SICOU_DOTNET may select the dotnet executable. Never targets an existing database.
"""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
DOTNET = os.environ.get("SICOU_DOTNET", shutil.which("dotnet") or "dotnet")
DOCKER = ["docker", "--host=unix:///var/run/docker.sock"]
container = "sicou-tokens-test-" + uuid.uuid4().hex[:10]
checks = 0


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


db_port, api_port = free_port(), free_port()
base = f"http://127.0.0.1:{api_port}"
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def check(condition, label):
    global checks
    if not condition:
        raise AssertionError(label)
    checks += 1
    print("PASS", label)


def sql(query):
    return subprocess.check_output(DOCKER + ["exec", "-i", container, "psql", "-U", "postgres", "-d", "sicou_tokens_test", "-At", "-v", "ON_ERROR_STOP=1"], input=query.encode()).decode().strip()


def request(method, path, token=None, body=None, form=False):
    boundary = "sicou-test-" + uuid.uuid4().hex
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}" if form else "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    payload = json.dumps(body).encode() if body is not None else None
    if form:
        payload = ("".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n' for key, value in body.items()) + f"--{boundary}--\r\n").encode()
    req = urllib.request.Request(base + path, data=payload, headers=headers, method=method)
    try:
        response = opener.open(req, timeout=20)
    except urllib.error.HTTPError as err:
        response = err
    raw = response.read()
    try:
        result = json.loads(raw) if raw else None
    except ValueError:
        result = None
    return response.status, result, response.headers


process = None
log = tempfile.TemporaryFile(mode="w+")
try:
    subprocess.run([DOTNET, "build", "backend/src/Api", "--nologo"], cwd=ROOT, check=True, stdout=log, stderr=log)
    subprocess.run(DOCKER + ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_DB=sicou_tokens_test", "-p", f"127.0.0.1:{db_port}:5432", "postgres:16-alpine"], check=True, stdout=subprocess.DEVNULL)
    for _ in range(60):
        ready = subprocess.run(DOCKER + ["exec", container, "pg_isready", "-U", "postgres"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if ready.returncode == 0:
            break
        time.sleep(0.5)
    env = dict(os.environ, ASPNETCORE_ENVIRONMENT="Development", ASPNETCORE_URLS=base,
               ConnectionStrings__DefaultConnection=f"Host=127.0.0.1;Port={db_port};Database=sicou_tokens_test;Username=postgres",
               Jwt__Key=secrets.token_hex(32), Jwt__Issuer="integration-test", Jwt__Audience="integration-test",
               Logging__LogLevel__Default="Warning", Automations__ScanIntervalSeconds="1")
    process = subprocess.Popen([DOTNET, "run", "--project", "backend/src/Api", "--no-build", "--no-launch-profile"], cwd=ROOT, env=env, stdout=log, stderr=log)
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError("API stopped before readiness")
        try:
            if request("GET", "/swagger/integrations/swagger.json")[0] == 200:
                break
        except OSError:
            pass
        time.sleep(0.5)
    else:
        raise RuntimeError("API did not become ready")

    status, doc, _ = request("GET", "/swagger/integrations/swagger.json")
    check(status == 200 and "/api/processes" in doc["paths"] and "/api/users" not in doc["paths"], "integration Swagger excludes administration")
    check(all(path in doc["paths"] for path in ["/api/posts", "/api/processes/{id}/draft", "/api/processes/{id}/protocol", "/api/processes/{id}/cancel", "/api/processes/{id}/transfer", "/api/processes/my", "/api/reports/processes"]), "integration Swagger covers requested operations")
    check("content" in doc["paths"]["/api/processes"]["post"]["responses"]["201"], "Swagger describes process response schema")
    check(request("GET", "/api/integrations/tokens")[0] == 401, "anonymous cannot manage tokens")
    sessions = []
    for index in range(2):
        status, session, _ = request("POST", "/api/auth/register", body={"fullName": f"Integration test {index}", "email": f"tokens{index}@example.test", "password": secrets.token_hex(12) + "Aa1!"})
        check(status == 200, f"test user {index} registered")
        sessions.append(session)
    a, b = sessions
    jwt = a["accessToken"]
    check(request("POST", "/api/integrations/tokens", jwt, {"name": "bad", "expiresInDays": 1, "scopes": ["admin:all"]})[0] == 400, "unknown scope rejected")
    check(request("POST", "/api/integrations/tokens", jwt, {"name": "bad", "expiresInDays": 0, "scopes": ["processes:read"]})[0] == 400, "zero validity rejected")
    check(request("POST", "/api/integrations/tokens", jwt, {"name": "bad", "expiresInDays": 1, "scopes": []})[0] == 400, "empty scopes rejected")

    def mint(scopes=None):
        status, value, headers = request("POST", "/api/integrations/tokens", jwt, {"name": "Test", "expiresInDays": 1, "scopes": scopes or ["processes:read"]})
        check(status == 201 and "no-store" in headers.get("Cache-Control", ""), "token created with no-store")
        return value

    token = mint()
    secret, token_id = token["token"], token["id"]
    stored = sql(f'SELECT "TokenHash" FROM integration_tokens WHERE "Id"=\'{token_id}\';')
    check(stored == hashlib.sha256(secret.encode()).hexdigest().upper() and secret not in stored, "only SHA256 hash persisted")
    _, items, _ = request("GET", "/api/integrations/tokens", jwt)
    check(secret not in json.dumps(items) and "tokenHash" not in json.dumps(items), "listing never returns secret or hash")
    check(request("GET", "/api/integrations/tokens", b["accessToken"])[1] == [], "tokens isolated between owners")
    check(request("DELETE", f"/api/integrations/tokens/{token_id}", b["accessToken"])[0] == 404, "another user cannot revoke")
    check(request("GET", "/api/processes/my", secret)[0] == 200, "token authenticates allowed read")
    check(request("POST", "/api/processes", secret, {})[0] == 403, "missing scope denied before business operation")
    check(request("GET", "/api/users", secret)[0] == 403, "administration denied")
    check(request("POST", "/api/integrations/tokens", secret, {"name": "child", "expiresInDays": 1, "scopes": ["processes:read"]})[0] == 403, "token cannot mint other tokens")
    check(request("GET", "/api/processes/my", "sic_" + "0" * 64)[0] == 401, "unknown token rejected")
    check(request("GET", "/api/processes/my", secret[:-1] + "!")[0] == 401, "malformed token rejected")

    report = mint(["reports:read"])
    check(request("GET", "/api/reports/options", report["token"])[0] == 403, "existing business authorization retained")
    time.sleep(0.2)  # Allow response completion audit writes.
    _, history, _ = request("GET", "/api/integrations/calls", jwt)
    check(any(c["statusCode"] == 200 and c["tokenId"] == token_id for c in history["items"]), "successful calls recorded")
    check(any(c["statusCode"] == 403 and c["route"] == "api/reports/options" for c in history["items"]), "exception middleware final status recorded")
    check(secret not in json.dumps(history) and "authorization" not in json.dumps(history).lower(), "call history contains no secrets")
    check(request("GET", "/api/integrations/calls", b["accessToken"])[1]["total"] == 0, "call history isolated between owners")
    check(request("GET", "/api/integrations/calls?page=0", jwt)[0] == 400, "pagination validated")
    request("DELETE", f"/api/integrations/tokens/{token_id}", jwt)
    check(request("GET", "/api/processes/my", secret)[0] == 401, "revoked token immediately rejected")

    for field, value in [("ExpiresAt", "NOW() - INTERVAL '1 minute'"), ("SecurityStamp", "'changed'"), ("CompanyId", f"'{uuid.uuid4()}'"), ("UnitId", f"'{uuid.uuid4()}'")]:
        candidate = mint()
        sql(f'UPDATE integration_tokens SET "{field}"={value} WHERE "Id"=\'{candidate["id"]}\';')
        check(request("GET", "/api/processes/my", candidate["token"])[0] == 401, f"changed {field} invalidates token")
    for field, value, restore in [("IsActive", "false", "true"), ("MustChangePassword", "true", "false")]:
        candidate = mint()
        user_id = a["user"]["id"]
        sql(f'UPDATE users SET "{field}"={value} WHERE "Id"=\'{user_id}\';')
        check(request("GET", "/api/processes/my", candidate["token"])[0] == 401, f"owner {field} invalidates token")
        sql(f'UPDATE users SET "{field}"={restore} WHERE "Id"=\'{user_id}\';')
    limited = mint()
    statuses = [request("GET", "/api/processes/my", limited["token"])[0] for _ in range(121)]
    check(statuses.count(200) == 120 and statuses[-1] == 429, "per-token rate limit enforced")

    company_a, company_b, area_a, area_b = [str(uuid.uuid4()) for _ in range(4)]
    user_id = a["user"]["id"]
    sql(f'''INSERT INTO companies ("Id", "Name", "CreatedAt", "IsActive") VALUES ('{company_a}', 'A', NOW(), true), ('{company_b}', 'B', NOW(), true);
        INSERT INTO areas ("Id", "CompanyId", "Name", "Slug", "CreatedAt", "IsActive") VALUES ('{area_a}', '{company_a}', 'Area A', 'a', NOW(), true), ('{area_b}', '{company_b}', 'Area B', 'b', NOW(), true);
        UPDATE users SET "CompanyId"='{company_a}' WHERE "Id"='{user_id}';
        INSERT INTO user_roles ("UserId", "RoleId") SELECT '{user_id}', "Id" FROM roles WHERE "Name"='COMPANY_ADMIN';''')
    tenant = mint(["reports:read", "posts:create"])
    _, options, _ = request("GET", "/api/reports/options", tenant["token"])
    check([c["id"] for c in options["companies"]] == [company_a], "token report options isolated to company")
    check(request("GET", f"/api/reports/processes?companyId={company_b}", tenant["token"])[0] == 403, "report cannot select another company")
    post = {"companyId": company_b, "title": "Integration test", "content": "Test"}
    check(request("POST", "/api/posts", tenant["token"], post, form=True)[0] == 403, "token cannot publish to another company")
    post["companyId"] = company_a
    check(request("POST", "/api/posts", tenant["token"], post, form=True)[0] == 201, "token creates post with current owner permissions")
    sql(f'DELETE FROM user_roles WHERE "UserId"=\'{user_id}\';')
    check(request("POST", "/api/posts", tenant["token"], post, form=True)[0] == 403, "removed owner role takes effect without reissuing token")
    from test_integrations_phase2 import run_phase2
    run_phase2(request, sql, check, a, b, company_a, company_b, area_a, area_b, ROOT, base)
    stale_call = str(uuid.uuid4())
    sql(f'''INSERT INTO integration_calls ("Id","TokenId","UserId","CreatedAt","Method","Route","StatusCode","DurationMs")
        VALUES ('{stale_call}','{token_id}','{a['user']['id']}',NOW()-INTERVAL '100 days','GET','test retention',200,1);''')
    process.terminate()
    process.wait(timeout=15)
    process = subprocess.Popen([DOTNET, "run", "--project", "backend/src/Api", "--no-build", "--no-launch-profile"], cwd=ROOT, env=env, stdout=log, stderr=log)
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError("API stopped during restart")
        try:
            if request('GET', '/swagger/integrations/swagger.json')[0] == 200 and sql(f'SELECT COUNT(*) FROM integration_calls WHERE "Id"=\'{stale_call}\';') == '0':
                break
        except OSError:
            pass
        time.sleep(0.25)
    check(sql(f'SELECT COUNT(*) FROM integration_calls WHERE "Id"=\'{stale_call}\';') == '0', 'background retention removes old API call logs')
    check(int(sql('SELECT COUNT(*) FROM automation_runs;')) > 0, 'execution history survives API restart')
    print(f"{checks} checks passed")
finally:
    if process:
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
    subprocess.run(DOCKER + ["stop", container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    log.seek(0)
    # Application logs may include data. Keep failures local; never dump credentials.
    if checks == 0:
        Path(tempfile.gettempdir(), "sicou-token-test-startup.log").write_text(log.read())
        print("Startup diagnostics: /tmp/sicou-token-test-startup.log")
    log.close()
