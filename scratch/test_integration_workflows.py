"""Validação HTTP da API de integração de Workflows (integrações sem usuário, Swagger separado e rotas v1).

Uso (API em execução, empresa com o workflow RH-CONTRATACAO semeado):
    SICOU_TEST_ADMIN_EMAIL=... SICOU_TEST_ADMIN_PASSWORD=... \
    SICOU_TEST_PSQL="podman exec -i sicou-postgres psql -U postgres -d BANCO -tA" \
    python3 scratch/test_integration_workflows.py http://127.0.0.1:5185

SICOU_TEST_PSQL é opcional: habilita os testes de expiração e de notificações.
Use somente contra bancos descartáveis de teste: o roteiro cria empresas, usuários, integrações e processos.
"""
import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5185"
V1 = f"{BASE}/api/integrations/v1"
PSQL = os.environ.get("SICOU_TEST_PSQL")

passed, failed = 0, []


def call(method, url, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            text = resp.read().decode()
            return resp.status, (json.loads(text) if text else None), dict(resp.headers)
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            parsed = json.loads(text) if text else None
        except json.JSONDecodeError:
            parsed = {"raw": text}
        return e.code, parsed, dict(e.headers)


def check(name, condition, detail=""):
    global passed
    if condition:
        passed += 1
        print(f"  ok   {name}")
    else:
        failed.append(name)
        print(f"  FAIL {name} {detail}")


def psql(sql):
    return subprocess.run(PSQL, shell=True, input=sql, capture_output=True, text=True, check=True).stdout.strip()


def login(email, password):
    status, body, _ = call("POST", f"{BASE}/api/auth/login", body={"email": email, "password": password})
    assert status == 200, (status, body)
    return body["accessToken"]


def new_integration(jwt, scopes, company_id=None, name=None):
    body = {"name": name or f"Agente {secrets.token_hex(3)}", "externalSystem": "Agente de testes", "scopes": scopes}
    if company_id:
        body["companyId"] = company_id
    return call("POST", f"{BASE}/api/integrations/tokens", jwt, body)


def sample_value(field):
    t = str(field.get("type"))
    if t in ("Date", "7"):
        return "2026-12-01"
    if t in ("Number", "3", "Currency", "4"):
        return 1500
    if t in ("Cpf", "5"):
        return "52998224725"
    if t in ("Cnpj", "6"):
        return "11222333000181"
    if t in ("Boolean", "10"):
        return True
    options = field.get("options") or field.get("globalOptionsJson")
    if t in ("Select", "8", "MultiSelect", "9") and options:
        try:
            parsed = json.loads(options)
            first = parsed[0] if parsed else "Opção"
        except (json.JSONDecodeError, TypeError):
            first = options.split(",")[0].strip()
        return [first] if t in ("MultiSelect", "9") else first
    return "Valor enviado pelo agente"


def main():
    admin_jwt = login(os.environ["SICOU_TEST_ADMIN_EMAIL"], os.environ["SICOU_TEST_ADMIN_PASSWORD"])
    _, companies, _ = call("GET", f"{BASE}/api/companies", admin_jwt)
    company = next(c for c in companies if c["name"] == "Empresa Integração Teste")

    print("\n1. Cadastro de integrações (JWT de sessão)")
    s, scopes, _ = call("GET", f"{BASE}/api/integrations/scopes", admin_jwt)
    check("lista escopos", s == 200 and {x["scope"] for x in scopes} >= {"workflows:read", "processes:move"})
    all_scopes = [x["scope"] for x in scopes]
    s, body, _ = new_integration(admin_jwt, all_scopes)
    check("Super Admin sem empresa selecionada recebe 400", s == 400 and "empresa" in body.get("message", "").lower(), (s, body))
    s, created, headers = new_integration(admin_jwt, all_scopes, company["id"], name="Agente completo")
    check("cadastra integração 201 com segredo sic_", s == 201 and created["token"].startswith("sic_"), (s, created))
    check("integração pertence à empresa e não tem usuário",
          created["companyId"] == company["id"] and "userId" not in created and created["companyName"] == company["name"], created)
    check("cadastro com Cache-Control no-store", "no-store" in headers.get("Cache-Control", ""))
    full = created["token"]
    s, listed, _ = call("GET", f"{BASE}/api/integrations/tokens", admin_jwt)
    serialized = json.dumps(listed)
    check("listagem não expõe segredo nem hash", full not in serialized and "tokenHash" not in serialized)
    check("listagem mostra prefixo e status Active",
          any(t["id"] == created["id"] and t["status"] == "Active" and full.startswith(t["tokenPrefix"]) for t in listed))
    s, by_company, _ = call("GET", f"{BASE}/api/integrations/tokens?companyId={company['id']}", admin_jwt)
    check("filtro por empresa", s == 200 and all(t["companyId"] == company["id"] for t in by_company))
    s, body, _ = new_integration(admin_jwt, ["processes:delete"], company["id"])
    check("escopo desconhecido 400", s == 400, (s, body))
    s, body, _ = new_integration(admin_jwt, [], company["id"])
    check("sem escopo 400", s == 400, (s, body))

    # Admin da Empresa e usuário operacional.
    def create_user(role, company_id):
        email = f"{role.lower()}.{secrets.token_hex(4)}@example.test"
        password = "Teste" + secrets.token_hex(6) + "A1"
        s, user, _ = call("POST", f"{BASE}/api/users", admin_jwt, {
            "fullName": f"Teste {role}", "email": email, "password": password, "companyId": company_id, "roles": [role]})
        assert s in (200, 201), (s, user)
        return user, login(email, password)

    _, hq_jwt = create_user("HEADQUARTER_USER", company["id"])
    s, _, _ = call("GET", f"{BASE}/api/integrations/tokens", hq_jwt)
    check("usuário operacional não gerencia integrações (403)", s == 403, s)

    s, other_company, _ = call("POST", f"{BASE}/api/companies", admin_jwt, {"name": f"Outra Empresa {secrets.token_hex(3)}"})
    _, ca_jwt = create_user("COMPANY_ADMIN", company["id"])
    s, ca_created, _ = new_integration(ca_jwt, ["processes:read"], name="Da empresa")
    check("Admin da Empresa cadastra para a própria empresa", s == 201 and ca_created["companyId"] == company["id"], (s, ca_created))
    s, body, _ = new_integration(ca_jwt, ["processes:read"], other_company["id"])
    check("Admin da Empresa não cadastra para outra empresa (403)", s == 403, (s, body))
    s, other_int, _ = new_integration(admin_jwt, all_scopes, other_company["id"], name="Outra empresa")
    s, ca_list, _ = call("GET", f"{BASE}/api/integrations/tokens", ca_jwt)
    check("Admin da Empresa só vê integrações da própria empresa",
          s == 200 and all(t["companyId"] == company["id"] for t in ca_list) and any(t["id"] == ca_created["id"] for t in ca_list))
    s, _, _ = call("DELETE", f"{BASE}/api/integrations/tokens/{other_int['id']}", ca_jwt)
    check("Admin da Empresa não revoga integração de outra empresa (404)", s == 404, s)

    print("\n2. Autenticação da API v1")
    s, body, headers = call("GET", f"{V1}/me")
    check("sem token 401 JSON", s == 401 and body and "message" in body, (s, body))
    check("401 com WWW-Authenticate", "Bearer" in headers.get("WWW-Authenticate", ""))
    s, body, _ = call("GET", f"{V1}/me", admin_jwt)
    check("JWT de sessão recusado na API v1 (401)", s == 401, (s, body))
    s, _, _ = call("GET", f"{V1}/me", "sic_" + secrets.token_urlsafe(32))
    check("token inexistente 401", s == 401)
    s, who, _ = call("GET", f"{V1}/me", full)
    check("GET /me identifica a integração, empresa e escopos",
          s == 200 and who["integrationId"] == created["id"] and who["companyId"] == company["id"]
          and who["name"] == "Agente completo" and set(who["scopes"]) == set(all_scopes), (s, who))
    s, _, _ = call("GET", f"{BASE}/api/companies", full)
    check("token sic_ não acessa a API da interface (401)", s == 401, s)
    s, _, _ = call("GET", f"{BASE}/api/integrations/tokens", full)
    check("token sic_ não gerencia integrações (401)", s == 401, s)

    print("\n3. Escopos (UC-020/E2)")
    s, body, _ = call("GET", f"{V1}/workflows", ca_created["token"])
    check("escopo insuficiente 403 com requiredScopes", s == 403 and body.get("requiredScopes") == ["workflows:read"], (s, body))
    s, _, _ = call("GET", f"{V1}/processes", ca_created["token"])
    check("escopo correto 200", s == 200, s)

    print("\n4. Workflows")
    s, workflows, _ = call("GET", f"{V1}/workflows", full)
    rh = next((w for w in workflows or [] if w["code"] == "RH-CONTRATACAO"), None)
    check("lista workflows homologados da empresa com RH-CONTRATACAO", s == 200 and rh is not None, (s, workflows))
    s, tree, _ = call("GET", f"{V1}/workflows/{rh['id']}", full)
    check("detalha workflow com campos e etapas", s == 200 and tree["fields"] and tree["nodes"], s)
    start_required = [f for f in tree["fields"] if f["processNodeId"] == tree["startNodeId"] and f["isRequired"]]
    check("workflow semeado tem campos obrigatórios na etapa inicial", len(start_required) > 0)

    print("\n5. Abertura")
    _, mine_before, _ = call("GET", f"{V1}/processes?mine=true&pageSize=200", full)
    s, body, _ = call("POST", f"{V1}/processes", full, {"workflowId": rh["id"], "submit": True, "fields": {}})
    check("abrir sem obrigatórios 400", s == 400 and "obrigat" in body.get("message", ""), (s, body))
    _, mine_after, _ = call("GET", f"{V1}/processes?mine=true&pageSize=200", full)
    check("falha no protocolo não deixa rascunho (gravação única)", mine_after["total"] == mine_before["total"],
          (mine_before["total"], mine_after["total"]))
    s, body, _ = call("POST", f"{V1}/processes", full, {"workflowId": rh["id"], "fields": {"CAMPO_INEXISTENTE": "x"}})
    check("campo inexistente 400 com códigos válidos", s == 400 and "Códigos válidos" in body.get("message", ""), (s, body))
    s, body, _ = call("POST", f"{V1}/processes", full, {"workflowId": rh["id"], "fields": {"x": {"a": 1}}})
    check("valor objeto recusado 400", s == 400, (s, body))

    notifications_before = int(psql("SELECT count(*) FROM user_notifications;")) if PSQL else 0
    fields = {f["code"]: sample_value(f) for f in start_required}
    s, proc, headers = call("POST", f"{V1}/processes", full, {
        "workflowId": rh["id"], "title": "Admissão aberta por agente", "fields": fields,
        "observations": "Aberto pelo agente de testes"})
    check("abre e protocola 201 com Location", s == 201 and proc["status"] == "InReview" and "Location" in headers, (s, proc))
    check("processo saiu da etapa inicial", proc["currentNodeId"] != tree["startNodeId"])
    check("autoria registrada como a integração",
          proc["createdByUserName"] == "Integração · Agente completo" and proc["createdByUserId"] == f"integration:{created['id']}", proc)
    check("histórico registra a integração como autora",
          all(h["userFullName"] == "Integração · Agente completo" for h in proc["history"]))
    if PSQL:
        check("ação da integração gera notificações", int(psql("SELECT count(*) FROM user_notifications;")) > notifications_before)
    pid = proc["id"]
    _, mine, _ = call("GET", f"{V1}/processes?mine=true&pageSize=200", full)
    check("mine=true lista processos abertos pela integração", any(p["id"] == pid for p in mine["items"]))

    s, draft, _ = call("POST", f"{V1}/processes", full, {"workflowId": rh["id"], "submit": False, "fields": {}})
    check("rascunho (submit=false) 201 Draft", s == 201 and draft["status"] == "Draft", (s, draft))
    s, st, _ = call("GET", f"{V1}/processes/{draft['id']}/status", full)
    check("status do rascunho indica updateDraft/submit e pendências",
          s == 200 and {"updateDraft", "submit"} <= set(st["availableActions"]) and st["pendingRequiredFields"], (s, st))
    s, body, _ = call("POST", f"{V1}/processes/{draft['id']}/advance", full, {})
    check("rascunho não pode ser tramitado antes do protocolo (400)", s == 400 and "submit" in body.get("message", ""), (s, body))
    s, updated, _ = call("PUT", f"{V1}/processes/{draft['id']}/draft", full, {"title": "Rascunho do agente", "fields": fields})
    check("atualiza rascunho por código de campo", s == 200 and updated["title"] == "Rascunho do agente"
          and len([v for v in updated["fieldValues"] if v["value"]]) >= len(fields), (s, updated))
    s, submitted, _ = call("POST", f"{V1}/processes/{draft['id']}/submit", full, {"observations": "Enviado pelo agente"})
    check("protocola rascunho", s == 200 and submitted["status"] == "InReview", (s, submitted))

    print("\n6. Status e tramitação")
    s, st, _ = call("GET", f"{V1}/processes/{pid}/status", full)
    check("status 200 com etapa atual e ações", s == 200 and st["currentNode"]["code"] and "advance" in st["availableActions"], (s, st))
    check("integração com processes:move pode tramitar (canManipulate)", st["canManipulate"] is True)
    check("status traz destinos de avanço", len(st["advanceTargets"]) > 0, st.get("advanceTargets"))
    check("status traz rótulo em português", st["statusLabel"] == "Em análise")
    s, body, _ = call("POST", f"{V1}/processes/{pid}/advance", full, {"targetNodeCode": "ETAPA_QUE_NAO_EXISTE"})
    check("advance com código de etapa inválido 400", s == 400, (s, body))
    if st["pendingRequiredFields"]:
        s, body, _ = call("POST", f"{V1}/processes/{pid}/advance", full, {"targetNodeId": st["advanceTargets"][0]["id"]})
        check("advance sem obrigatórios da etapa 400", s == 400, (s, body))

    target = next((t for t in st["advanceTargets"] if t["type"] != "EndRejected"), st["advanceTargets"][0])
    stage_fields = {f["code"]: sample_value(f) for f in st["pendingRequiredFields"]}
    s, adv, _ = call("POST", f"{V1}/processes/{pid}/advance", full, {
        "targetNodeCode": target["code"], "observations": "Parecer do agente: documentos conferidos.", "fields": stage_fields})
    check("advance por código de etapa 200", s == 200 and adv["currentNodeId"] == target["id"], (s, adv))
    check("histórico registra o avanço com parecer da integração",
          any("Parecer do agente" in (h.get("observations") or "") and h["userFullName"].startswith("Integração") for h in adv["history"]))

    s, st2, _ = call("GET", f"{V1}/processes/{pid}/status", full)
    if not st2["isTerminal"]:
        check("status indica destinos de devolução", len(st2["returnTargets"]) > 0, st2.get("returnTargets"))
        s, ret, _ = call("POST", f"{V1}/processes/{pid}/return", full, {"observations": "Faltou documento, devolvido pelo agente."})
        check("return 200 Devolvido", s == 200 and ret["status"] == "Returned", (s, ret))
        s, body, _ = call("POST", f"{V1}/processes/{pid}/return", full, {"observations": ""})
        check("return sem justificativa 400", s == 400, (s, body))
        s, rst, _ = call("POST", f"{V1}/processes/{pid}/restart", full, {"observations": "Reinício pelo agente"})
        check("restart 200 volta à etapa inicial", s == 200 and rst["currentNodeId"] == tree["startNodeId"], (s, rst))
        s, resub, _ = call("POST", f"{V1}/processes/{pid}/submit", full, {"observations": "Reenviado pelo agente"})
        check("reenvio de processo devolvido 200", s == 200 and resub["status"] == "InReview", (s, resub))

    s, com, _ = call("POST", f"{V1}/processes/{pid}/comments", full, {"observations": "Comentário do agente"})
    check("comentário 200", s == 200 and any(h["observations"] == "Comentário do agente" for h in com["history"]), (s, com))
    s, units, _ = call("GET", f"{BASE}/api/companies/{company['id']}/units", admin_jwt)
    other_unit = next((u for u in units if u["id"] != proc.get("currentUnitId")), None)
    if other_unit:
        s, tr, _ = call("POST", f"{V1}/processes/{pid}/transfer", full, {"destinationUnitId": other_unit["id"], "observations": "Transferido pelo agente"})
        check("transferência 200", s == 200 and tr["currentUnitId"] == other_unit["id"], (s, tr))
    s, hist, _ = call("GET", f"{V1}/processes/{pid}/history", full)
    check("histórico ordenado do mais antigo ao mais recente", s == 200 and hist == sorted(hist, key=lambda h: h["createdAt"]))
    s, page, _ = call("GET", f"{V1}/processes?search={proc['processNumber']}&pageSize=5", full)
    check("lista filtra por número", s == 200 and any(p["id"] == pid for p in page["items"]), (s, page))
    s, _, _ = call("GET", f"{V1}/processes?pageSize=500", full)
    check("pageSize acima de 200 recusado 400", s == 400, s)

    s, can, _ = call("POST", f"{V1}/processes/{pid}/cancel", full, {"reason": "Cancelado pelo agente de testes"})
    check("cancelamento 200", s == 200 and can["status"] == "AdministrativeCancellation", (s, can))
    s, st3, _ = call("GET", f"{V1}/processes/{pid}/status", full)
    check("status terminal sem ações", st3["isTerminal"] and st3["availableActions"] == [], st3)
    s, body, _ = call("POST", f"{V1}/processes/{pid}/advance", full, {})
    check("advance em processo cancelado 400", s == 400, (s, body))
    s, _, _ = call("GET", f"{V1}/processes/00000000-0000-0000-0000-000000000001", full)
    check("processo inexistente 404", s == 404, s)

    print("\n7. Isolamento por empresa")
    s, body, _ = call("GET", f"{V1}/processes/{submitted['id']}", other_int["token"])
    check("integração de outra empresa não vê o processo (404)", s == 404, (s, body))
    s, body, _ = call("POST", f"{V1}/processes/{submitted['id']}/advance", other_int["token"], {})
    check("integração de outra empresa não tramita o processo (404)", s == 404, (s, body))
    s, body, _ = call("GET", f"{V1}/workflows/{rh['id']}", other_int["token"])
    check("integração de outra empresa não vê o workflow (404)", s == 404, (s, body))
    s, other_list, _ = call("GET", f"{V1}/processes?pageSize=200", other_int["token"])
    check("listagem da outra empresa não traz processos desta", s == 200 and all(p["id"] != submitted["id"] for p in other_list["items"]))

    print("\n8. Swagger separado")
    s, doc, _ = call("GET", f"{BASE}/swagger/integrations/swagger.json")
    paths = list((doc or {}).get("paths", {}).keys())
    check("documento de integrações publicado", s == 200 and paths, s)
    check("documento de integrações contém só rotas v1", paths and all(p.startswith("/api/integrations/v1") for p in paths), paths[:5])
    schemes = list(doc.get("components", {}).get("securitySchemes", {}).keys())
    check("documento de integrações usa só IntegrationToken", schemes == ["IntegrationToken"], schemes)
    advance_op = doc["paths"].get("/api/integrations/v1/processes/{id}/advance", {}).get("post", {})
    check("operação descreve o escopo exigido", "processes:move" in advance_op.get("description", ""), advance_op.get("description"))
    s, full_doc, _ = call("GET", f"{BASE}/swagger/v1/swagger.json")
    check("documento completo não lista rotas v1 de integração",
          s == 200 and not any(p.startswith("/api/integrations/v1") for p in full_doc["paths"]))
    with urllib.request.urlopen(urllib.request.Request(f"{BASE}/integrations/docs/index.html")) as resp:
        check("Swagger UI de integrações em /integrations/docs", resp.status == 200)

    print("\n9. Renovação, revogação, expiração e empresa inativa")
    s, renewed, _ = call("POST", f"{BASE}/api/integrations/tokens/{ca_created['id']}/renew", admin_jwt)
    check("renovação 200 com novo segredo", s == 200 and renewed["token"].startswith("sic_") and renewed["token"] != ca_created["token"], (s, renewed))
    s, _, _ = call("GET", f"{V1}/me", ca_created["token"])
    check("segredo anterior deixa de valer após renovar (401)", s == 401, s)
    s, _, _ = call("GET", f"{V1}/me", renewed["token"])
    check("novo segredo funciona", s == 200, s)
    s, tmp, _ = new_integration(admin_jwt, ["processes:read"], company["id"], name="Para revogar")
    s, _, _ = call("DELETE", f"{BASE}/api/integrations/tokens/{tmp['id']}", admin_jwt)
    check("revogação 204", s == 204, s)
    s, _, _ = call("GET", f"{V1}/me", tmp["token"])
    check("token revogado 401", s == 401, s)
    s, _, _ = call("DELETE", f"{BASE}/api/integrations/tokens/{tmp['id']}", admin_jwt)
    check("revogar de novo é idempotente (204)", s == 204, s)
    s, body, _ = call("POST", f"{BASE}/api/integrations/tokens/{tmp['id']}/renew", admin_jwt)
    check("integração revogada não pode ser renovada (400)", s == 400, (s, body))
    if PSQL:
        _, exp, _ = new_integration(admin_jwt, ["processes:read"], company["id"], name="Para expirar")
        psql(f"UPDATE integration_tokens SET \"ExpiresAt\" = now() - interval '1 minute' WHERE \"Id\" = '{exp['id']}';")
        s, body, _ = call("GET", f"{V1}/me", exp["token"])
        check("token expirado 401 (UC-020/E1)", s == 401 and "expirado" in body.get("message", ""), (s, body))
        s, ren, _ = call("POST", f"{BASE}/api/integrations/tokens/{exp['id']}/renew", admin_jwt)
        s2, _, _ = call("GET", f"{V1}/me", ren["token"])
        check("token expirado é renovado e volta a funcionar", s == 200 and s2 == 200, (s, s2))
    s, _, _ = call("DELETE", f"{BASE}/api/companies/{other_company['id']}", admin_jwt)
    s, _, _ = call("GET", f"{V1}/me", other_int["token"])
    check("empresa inativa invalida a integração (401)", s == 401, s)
    s, listed, _ = call("GET", f"{BASE}/api/integrations/tokens", admin_jwt)
    check("listagem marca integração de empresa inativa como Invalidated",
          any(t["id"] == other_int["id"] and t["status"] == "Invalidated" for t in listed))

    print("\n10. Auditoria (UC-020, passo 5)")
    s, calls, _ = call("GET", f"{BASE}/api/integrations/calls?tokenId={created['id']}&pageSize=100", admin_jwt)
    routes = {c["route"] for c in calls["items"]}
    check("chamadas da integração registradas", s == 200 and calls["total"] >= 15, (s, calls and calls.get("total")))
    check("rotas gravadas como template, sem IDs nem query",
          "api/integrations/v1/processes/{id:guid}/advance" in routes and not any("?" in r or pid in r for r in routes), routes)
    check("chamada de processo vincula o processo afetado", any(c["processInstanceId"] == pid for c in calls["items"]))
    check("erros também são auditados", any(c["statusCode"] >= 400 for c in calls["items"]))
    s, ro_calls, _ = call("GET", f"{BASE}/api/integrations/calls?tokenId={ca_created['id']}", admin_jwt)
    check("403 de escopo auditado", any(c["statusCode"] == 403 for c in ro_calls["items"]), ro_calls)
    check("indicadores dos últimos 7 dias", calls["callsLast7Days"] >= calls["total"] and calls["errorsLast7Days"] > 0)

    print("\n11. Limite de chamadas")
    _, burst, _ = new_integration(admin_jwt, ["processes:read"], company["id"], name="Rajada")
    limit = int(os.environ.get("SICOU_TEST_RATE_LIMIT", "120"))
    for _ in range(limit + 1):
        call("GET", f"{V1}/me", burst["token"])
    s, _, headers = call("GET", f"{V1}/me", burst["token"])
    check("excesso de chamadas retorna 429 com Retry-After", s == 429 and "Retry-After" in headers, s)

    print(f"\nResultado: {passed} aprovadas, {len(failed)} falharam")
    for name in failed:
        print(f"  - {name}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
