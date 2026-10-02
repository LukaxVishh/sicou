import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = "http://localhost:5175"

def api_post(path, data=None, token=None, form_data=None, boundary=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    if form_data:
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        body = form_data.encode('utf-8')
    elif data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode('utf-8')
    else:
        body = None

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, err_body

def api_get(path, token=None):
    url = f"{BASE_URL}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, err_body

def login(email, password):
    status, res = api_post("/api/auth/login", {"email": email, "password": password})
    if status == 200:
        token = res.get("accessToken") or res.get("token")
        user = res.get("user")
        return token, user
    raise Exception(f"Login failed for {email}: {status} {res}")

def build_multipart(fields):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    lines = []
    for name, value in fields.items():
        lines.append(f"--{boundary}")
        lines.append(f'Content-Disposition: form-data; name="{name}"')
        lines.append("")
        lines.append(str(value))
    lines.append(f"--{boundary}--")
    lines.append("")
    return "\r\n".join(lines), boundary

def run_tests():
    print("=== TESTE DE SEGURANÇA E ISOLAMENTO DE ACESSOS ===")
    
    # 1. Login com SuperAdmin para obter IDs de empresas e áreas
    super_token, _ = login("admin@sicou.com", "Admin123")
    print("1. Login SuperAdmin OK")

    status, companies = api_get("/api/companies", super_token)
    aurora = next((c for c in companies if "Aurora" in c["name"]), companies[0])
    aurora_id = aurora["id"]

    status, areas = api_get(f"/api/companies/{aurora_id}/areas", super_token)
    print("Areas:", [(a["name"], a["id"]) for a in areas])
    juridico = next(a for a in areas if "Jur" in a["name"] or "jur" in a["slug"])
    financeiro = next(a for a in areas if "Finan" in a["name"] or "fin" in a["slug"])
    print(f"   Empresa: {aurora['name']} ({aurora_id})")
    print(f"   Área Jurídico: {juridico['name']} ({juridico['id']})")
    print(f"   Área Financeiro: {financeiro['name']} ({financeiro['id']})")

    # 2. Login com Gestor Jurídico
    gestor_jur_token, gestor_jur_user = login("gestor.juridico@aurora.com", "Senha@123")
    print("\n2. Login Gestor Jurídico OK")

    # 2a. Publicar no Jurídico -> DEVE TER SUCESSO
    post_jur_body, b1 = build_multipart({
        "title": "Informativo Jurídico: Atualização Contratual",
        "content": "Orientações sobre as novas cláusulas de conformidade.",
        "areaId": juridico["id"]
    })
    status, res = api_post("/api/posts", token=gestor_jur_token, form_data=post_jur_body, boundary=b1)
    print(f"   Postar na sua própria área (Jurídico): Status {status} -> {'SUCESSO (Esperado)' if status in (200, 201) else 'FALHA'}")
    assert status in (200, 201), f"Falhou ao postar na própria área: {res}"

    # 2b. Tentar publicar no Financeiro -> DEVE SER BLOQUEADO (403 Forbidden)
    post_fin_body, b2 = build_multipart({
        "title": "Tentativa Não Autorizada no Financeiro",
        "content": "Este post deveria ser bloqueado.",
        "areaId": financeiro["id"]
    })
    status, res = api_post("/api/posts", token=gestor_jur_token, form_data=post_fin_body, boundary=b2)
    print(f"   Postar na área de outro setor (Financeiro): Status {status} -> {'BLOQUEADO 403 (Esperado)' if status == 403 else 'FALHA DE SEGURANÇA'}")
    assert status == 403, f"Segurança violada! Post em outra área retornou status {status}: {res}"

    # 3. Teste de Visualização de Processos: Unidade vs Sede
    print("\n3. Teste de Isolamento de Processos:")
    
    # 3a. Obter unidades da Aurora
    status, units = api_get(f"/api/companies/{aurora_id}/units", super_token)
    cascavel = next(u for u in units if "Cascavel" in u["name"])
    toledo = next(u for u in units if "Toledo" in u["name"])
    print(f"   Unidade Cascavel: {cascavel['id']}")
    print(f"   Unidade Toledo: {toledo['id']}")

    # 3b. Obter processos disponíveis para abertura
    gestor_cascavel_token, _ = login("gestor.cascavel@aurora.com", "Senha@123")
    gestor_toledo_token, _ = login("gestor.toledo@aurora.com", "Senha@123")
    
    # Consultar processos da área Jurídica como Gestor Cascavel
    status, procs_cascavel = api_get(f"/api/areas/{juridico['id']}/processes", gestor_cascavel_token)
    print(f"   Consulta Processos Jurídico pelo Gestor Cascavel: Status {status}")
    if status == 200:
        for p in procs_cascavel:
            print(f"     -> Processo: {p['processNumber']} | Origem: {p.get('originUnitName', 'N/A')}")
            # Nenhum processo de outra unidade deve vir
            if p.get('originUnitName'):
                assert "Cascavel" in p['originUnitName'], f"Vazamento de dados: Processo {p['processNumber']} pertence a {p['originUnitName']} mas foi visto por Cascavel!"

    # Consultar processos da área Jurídica como Gestor Jurídico (Sede) -> Vê todos
    status, procs_sede = api_get(f"/api/areas/{juridico['id']}/processes", gestor_jur_token)
    print(f"   Consulta Processos Jurídico pelo Gestor Jurídico (Sede): Status {status} -> Total: {len(procs_sede) if status == 200 else 0}")
    
    print("\n=== TODOS OS TESTES DE SEGURANÇA E ISOLAMENTO PASSARAM COM SUCESSO! ===")

if __name__ == "__main__":
    run_tests()
