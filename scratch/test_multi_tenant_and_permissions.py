import urllib.request
import urllib.error
import json
import time
import sys

BASE_URL = "http://localhost:8080"

def log(msg):
    print(f"[TEST-SUITE] {msg}")

def request(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            resp_body = resp.read().decode("utf-8")
            data = json.loads(resp_body) if resp_body else None
            return status, data
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode("utf-8")
        try:
            data = json.loads(resp_body) if resp_body else None
        except Exception:
            data = resp_body
        return e.code, data
    except Exception as e:
        return 0, str(e)

def create_post_multipart(title, content, company_id=None, token=None):
    boundary = "----SicouBoundary" + str(int(time.time() * 1000))
    body_parts = []
    
    body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"title\"\r\n\r\n{title}\r\n")
    body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"content\"\r\n\r\n{content}\r\n")
    if company_id:
        body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"companyId\"\r\n\r\n{company_id}\r\n")
    body_parts.append(f"--{boundary}--\r\n")
    
    raw_body = "".join(body_parts).encode("utf-8")
    
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    req = urllib.request.Request(f"{BASE_URL}/api/posts", data=raw_body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            resp_body = resp.read().decode("utf-8")
            data = json.loads(resp_body) if resp_body else None
            return status, data
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode("utf-8")
        try:
            data = json.loads(resp_body) if resp_body else None
        except Exception:
            data = resp_body
        return e.code, data
    except Exception as e:
        return 0, str(e)

def assert_status(actual_status, expected_statuses, context_msg, body=None):
    if isinstance(expected_statuses, int):
        expected_statuses = [expected_statuses]
    if actual_status not in expected_statuses:
        print(f"FAILED: {context_msg}")
        print(f"  Expected status: {expected_statuses}, got: {actual_status}")
        print(f"  Response body: {body}")
        raise AssertionError(f"Status mismatch for {context_msg}")
    else:
        print(f"  PASS: {context_msg} (HTTP {actual_status})")

def login(email, password):
    status, res = request("POST", "/api/auth/login", {"email": email, "password": password})
    if status != 200:
        raise Exception(f"Failed to login with {email}: {res}")
    return res["accessToken"]

def main():
    log("==========================================================================")
    log("INICIANDO SUITE DE TESTES MULTI-TENANT E MATRIZ DE PERMISSOES DO SICOU")
    log("==========================================================================")

    # 1. Login Super Admin
    log("1. Autenticando como Super Admin (admin@sicou.com)...")
    super_admin_token = login("admin@sicou.com", "Admin123")

    ts = int(time.time()) % 100000

    # 2. Criar 5 Empresas
    log("\n2. Criando 5 Empresas...")
    companies = []
    company_names = [
        f"Cooperativa Pioneira Alpha #{ts}",
        f"Agroindustria Beta Sul #{ts}",
        f"Logistica e Distribuicao Gamma #{ts}",
        f"Cooperativa de Credito Delta #{ts}",
        f"Tecnologia e Servicos Epsilon #{ts}",
    ]

    for idx, c_name in enumerate(company_names, start=1):
        doc = f"{idx:02d}.{ts:05d}.000/0001-{idx:02d}"
        status, res = request("POST", "/api/companies", {"name": c_name, "document": doc}, token=super_admin_token)
        assert_status(status, [200, 201], f"Criar Empresa {idx}: {c_name}", res)
        companies.append(res)

    # 3. Para cada empresa, criar 5 Áreas da Sede e 1 Unidade
    log("\n3. Criando 5 Areas da Sede e 1 Unidade em cada uma das 5 Empresas (Total: 25 areas)...")
    areas_by_company = {}
    units_by_company = {}

    area_definitions = [
        ("Juridico", "Gestao de contratos, compliance e pareceres"),
        ("Recursos Humanos", "Gestao de pessoas, capacitacao e beneficios"),
        ("Tecnologia da Informacao", "Sistemas, infraestrutura e seguranca"),
        ("Controladoria e Financas", "Auditoria, planejamento e orcamento"),
        ("Operacoes e Logistica", "Distribuicao, suporte operacional e rotinas"),
    ]

    for c_idx, company in enumerate(companies, start=1):
        c_id = company["id"]
        areas_by_company[c_id] = []

        # Criar 1 Unidade (Filial)
        u_status, u_res = request("POST", f"/api/companies/{c_id}/units", {
            "name": f"Agencia Central {company['name']}",
            "code": f"AG0{c_idx}",
            "city": "Curitiba",
            "state": "PR"
        }, token=super_admin_token)
        assert_status(u_status, [200, 201], f"[Empresa {c_idx}] Criar Unidade AG0{c_idx}", u_res)
        units_by_company[c_id] = u_res

        # Criar 5 Áreas
        for a_name, a_desc in area_definitions:
            a_status, a_res = request("POST", f"/api/companies/{c_id}/areas", {
                "name": f"{a_name} {c_idx}",
                "description": a_desc,
                "moduleCodes": ["Informatives", "Guide", "Workflows"]
            }, token=super_admin_token)
            assert_status(a_status, [200, 201], f"[Empresa {c_idx}] Criar Area {a_name} {c_idx}", a_res)
            areas_by_company[c_id].append(a_res)

    # 4. Criar 5 Usuários por Empresa (Total: 25 usuários)
    log("\n4. Criando 5 Usuarios por Empresa com papeis especificos (Total: 25 usuarios)...")
    users_by_company = {}

    for c_idx, company in enumerate(companies, start=1):
        c_id = company["id"]
        u_id = units_by_company[c_id]["id"]
        users_by_company[c_id] = {}

        user_configs = [
            ("admin", f"Admin Empresa {c_idx}", f"admin.empresa{c_idx}.{ts}@sicou.com", ["COMPANY_ADMIN"], None),
            ("juridico", f"Gestor Juridico {c_idx}", f"juridico.empresa{c_idx}.{ts}@sicou.com", ["HEADQUARTER_USER"], None),
            ("rh", f"Publicador RH {c_idx}", f"rh.empresa{c_idx}.{ts}@sicou.com", ["HEADQUARTER_USER"], None),
            ("ti", f"Leitor TI {c_idx}", f"ti.empresa{c_idx}.{ts}@sicou.com", ["HEADQUARTER_USER"], None),
            ("unidade", f"Atendente Filial {c_idx}", f"unidade.empresa{c_idx}.{ts}@sicou.com", ["UNIT_USER"], u_id),
        ]

        for key, name, email, roles, unit_id in user_configs:
            payload = {
                "fullName": name,
                "email": email,
                "password": "Password123!",
                "companyId": c_id,
                "unitId": unit_id,
                "roles": roles
            }
            usr_status, usr_res = request("POST", "/api/users", payload, token=super_admin_token)
            assert_status(usr_status, [200, 201], f"[Empresa {c_idx}] Criar Usuario '{name}' ({roles[0]})", usr_res)
            users_by_company[c_id][key] = {"data": usr_res, "email": email, "password": "Password123!"}

    # 5. Configurar Permissões Granulares (UserAreaAccess)
    log("\n5. Concedendo regras de acesso granular por Area dentro de cada empresa...")
    for c_idx, company in enumerate(companies, start=1):
        c_id = company["id"]
        comp_areas = areas_by_company[c_id]
        comp_users = users_by_company[c_id]

        # Regra 1: Gestor Jurídico -> Permissão Total na Área 0 (Jurídico)
        jur_user_id = comp_users["juridico"]["data"]["id"]
        jur_area_id = comp_areas[0]["id"]
        s1, r1 = request("POST", "/api/user-area-accesses", {
            "userId": jur_user_id,
            "companyId": c_id,
            "areaId": jur_area_id,
            "canView": True,
            "canManage": True,
            "canPublishInformatives": True,
            "canManageGuide": True,
            "canManageWorkflows": True,
            "canHandleWorkflowRequests": True
        }, token=super_admin_token)
        assert_status(s1, [200, 201], f"[Empresa {c_idx}] Permissao Total Juridico ({comp_users['juridico']['email']})", r1)

        # Regra 2: RH -> Publicador de Informativos na Área 1 (RH)
        rh_user_id = comp_users["rh"]["data"]["id"]
        rh_area_id = comp_areas[1]["id"]
        s2, r2 = request("POST", "/api/user-area-accesses", {
            "userId": rh_user_id,
            "companyId": c_id,
            "areaId": rh_area_id,
            "canView": True,
            "canManage": False,
            "canPublishInformatives": True,
            "canManageGuide": False,
            "canManageWorkflows": False,
            "canHandleWorkflowRequests": False
        }, token=super_admin_token)
        assert_status(s2, [200, 201], f"[Empresa {c_idx}] Permissao Publicar Informativos RH ({comp_users['rh']['email']})", r2)

        # Regra 3: TI -> Apenas Visualização na Área 2 (TI) (canPublishInformatives = False)
        ti_user_id = comp_users["ti"]["data"]["id"]
        ti_area_id = comp_areas[2]["id"]
        s3, r3 = request("POST", "/api/user-area-accesses", {
            "userId": ti_user_id,
            "companyId": c_id,
            "areaId": ti_area_id,
            "canView": True,
            "canManage": False,
            "canPublishInformatives": False,
            "canManageGuide": False,
            "canManageWorkflows": False,
            "canHandleWorkflowRequests": False
        }, token=super_admin_token)
        assert_status(s3, [200, 201], f"[Empresa {c_idx}] Permissao Somente Leitura TI ({comp_users['ti']['email']})", r3)

        # Regra 4: Unidade -> Apenas Visualização
        unidade_user_id = comp_users["unidade"]["data"]["id"]
        op_area_id = comp_areas[4]["id"]
        s4, r4 = request("POST", "/api/user-area-accesses", {
            "userId": unidade_user_id,
            "companyId": c_id,
            "areaId": op_area_id,
            "unitId": units_by_company[c_id]["id"],
            "canView": True,
            "canManage": False,
            "canPublishInformatives": False,
            "canManageGuide": False,
            "canManageWorkflows": False,
            "canHandleWorkflowRequests": False
        }, token=super_admin_token)
        assert_status(s4, [200, 201], f"[Empresa {c_idx}] Permissao Visualizacao Unidade ({comp_users['unidade']['email']})", r4)

    # =========================================================================
    # 6. TESTES DE ISOLAMENTO MULTI-TENANT
    # =========================================================================
    log("\n" + "="*70)
    log("6. TESTES DE SEGURANCA: ISOLAMENTO MULTI-TENANT ENTRE EMPRESAS")
    log("="*70)

    empresa1 = companies[0]
    empresa2 = companies[1]
    empresa1_admin = users_by_company[empresa1["id"]]["admin"]

    emp1_token = login(empresa1_admin["email"], empresa1_admin["password"])

    # 6.1 Admin da Empresa 1 lista empresas: deve ver APENAS Empresa 1
    s_comp, res_comp = request("GET", "/api/companies", token=emp1_token)
    assert_status(s_comp, 200, "Admin Empresa 1 lista empresas", res_comp)
    assert len(res_comp) == 1 and res_comp[0]["id"] == empresa1["id"], f"Vazamento de dados! Admin da Empresa 1 viu {len(res_comp)} empresas!"
    print(f"  PASS: Admin Empresa 1 listou apenas a sua propria empresa (1 registro retornado).")

    # 6.2 Admin da Empresa 1 tenta consultar detalhes da Empresa 2
    s_oc, res_other_comp = request("GET", f"/api/companies/{empresa2['id']}", token=emp1_token)
    assert_status(s_oc, 403, "Admin Empresa 1 tenta acessar Empresa 2 diretamente (GET /api/companies/{id}) -> Bloqueado com 403", res_other_comp)

    # 6.3 Admin da Empresa 1 tenta listar areas da Empresa 2
    s_oa, res_other_areas = request("GET", f"/api/companies/{empresa2['id']}/areas", token=emp1_token)
    assert_status(s_oa, 403, "Admin Empresa 1 tenta acessar Areas da Empresa 2 -> Bloqueado com 403", res_other_areas)

    # 6.4 Admin da Empresa 1 tenta listar unidades da Empresa 2
    s_ou, res_other_units = request("GET", f"/api/companies/{empresa2['id']}/units", token=emp1_token)
    assert_status(s_ou, 403, "Admin Empresa 1 tenta acessar Unidades da Empresa 2 -> Bloqueado com 403", res_other_units)

    # 6.5 Admin da Empresa 1 tenta listar permissoes da Empresa 2
    s_oacc, res_other_accesses = request("GET", f"/api/user-area-accesses/by-company/{empresa2['id']}", token=emp1_token)
    assert_status(s_oacc, 403, "Admin Empresa 1 tenta acessar Controle de Acessos da Empresa 2 -> Bloqueado com 403", res_other_accesses)

    # 6.6 Admin da Empresa 1 lista usuários: não deve ver usuários da Empresa 2
    s_u, res_users = request("GET", "/api/users", token=emp1_token)
    assert_status(s_u, 200, "Admin Empresa 1 lista usuarios da sua empresa", res_users)
    for u in res_users:
        assert u["companyId"] == empresa1["id"], f"Vazamento! Usuario {u['email']} de outra empresa retornado para Empresa 1!"
    print(f"  PASS: Todos os {len(res_users)} usuarios listados pertencem estritamente a Empresa 1.")

    # =========================================================================
    # 7. TESTES DE PUBLICACAO NO FEED E REGRAS DE PERMISSAO SETORIAL
    # =========================================================================
    log("\n" + "="*70)
    log("7. TESTES DE PUBLICACAO NO FEED E REGRAS DE PERMISSAO SETORIAL")
    log("="*70)

    # 7.1 Gestor Jurídico Empresa 1 (canPublishInformatives = True) cria post
    jur_user = users_by_company[empresa1["id"]]["juridico"]
    jur_token = login(jur_user["email"], jur_user["password"])

    s_pj, post_jur_res = create_post_multipart(
        title=f"Parecer Juridico de Compliance Alpha #{ts}",
        content="Orientacoes sobre normas regulatorias e termos de cooperacao da sede.",
        company_id=empresa1["id"],
        token=jur_token
    )
    assert_status(s_pj, [200, 201], "Gestor Juridico (CanPublish=True) cria post setorial -> SUCESSO", post_jur_res)

    # 7.2 Publicador RH Empresa 1 (canPublishInformatives = True) cria post
    rh_user = users_by_company[empresa1["id"]]["rh"]
    rh_token = login(rh_user["email"], rh_user["password"])

    s_prh, post_rh_res = create_post_multipart(
        title=f"Comunicado RH: Beneficios e Ferias Coletivas #{ts}",
        content="Divulgacao oficial do calendario de ferias e politicas internas do departamento de RH.",
        company_id=empresa1["id"],
        token=rh_token
    )
    assert_status(s_prh, [200, 201], "Publicador RH (CanPublish=True) cria post setorial -> SUCESSO", post_rh_res)

    # 7.3 Leitor TI Empresa 1 (canPublishInformatives = False) tenta criar post -> DEVE SER BLOQUEADO!
    ti_user = users_by_company[empresa1["id"]]["ti"]
    ti_token = login(ti_user["email"], ti_user["password"])

    s_pti, post_ti_res = create_post_multipart(
        title="Tentativa de Publicacao Nao Autorizada TI",
        content="Este post nao deve ser criado porque o usuario nao tem permissao de publicacao.",
        company_id=empresa1["id"],
        token=ti_token
    )
    assert_status(s_pti, 403, "Leitor TI (CanPublish=False) tenta criar post -> BLOQUEADO COM 403", post_ti_res)

    # =========================================================================
    # 8. TESTES DE USUARIOS DE UNIDADE (UNIT_USER)
    # =========================================================================
    log("\n" + "="*70)
    log("8. TESTES DE USUARIOS DE UNIDADE (UNIT_USER)")
    log("="*70)

    unidade_user = users_by_company[empresa1["id"]]["unidade"]
    unidade_token = login(unidade_user["email"], unidade_user["password"])

    # 8.1 Usuário de Unidade tenta criar post -> DEVE SER BLOQUEADO
    s_puni, post_unidade_res = create_post_multipart(
        title="Post Criado por Usuario de Unidade",
        content="Tentativa de criar post por usuario de filial.",
        company_id=empresa1["id"],
        token=unidade_token
    )
    assert_status(s_puni, 403, "Usuario de Unidade (UNIT_USER) tenta criar post -> BLOQUEADO COM 403", post_unidade_res)

    # 8.2 Usuário de Unidade consulta feed da sua empresa -> DEVE VISUALIZAR OS POSTS DA SEDE
    s_funi, feed_unidade_res = request("GET", "/api/posts", token=unidade_token)
    assert_status(s_funi, 200, "Usuario de Unidade consulta feed da sua empresa (GET /api/posts)", feed_unidade_res)
    feed_items = feed_unidade_res["items"]
    feed_titles = [p["title"] for p in feed_items]
    print(f"  PASS: Feed carregado com sucesso pelo usuario da unidade ({len(feed_items)} posts recebidos).")
    assert any(f"Parecer Juridico de Compliance Alpha #{ts}" in t for t in feed_titles), "Post do Juridico nao visivel para unidade!"
    assert any(f"Comunicado RH: Beneficios e Ferias Coletivas #{ts}" in t for t in feed_titles), "Post do RH nao visivel para unidade!"

    # 8.3 Usuário de Unidade da Empresa 1 tenta consultar posts da Empresa 2 -> DEVE SER BLOQUEADO COM 403
    s_foth, feed_other_comp = request("GET", f"/api/posts?companyId={empresa2['id']}", token=unidade_token)
    assert_status(s_foth, 403, "Usuario de Unidade tenta filtrar posts da Empresa 2 -> BLOQUEADO COM 403", feed_other_comp)

    # =========================================================================
    # 9. VALIDACAO CRUZADA EM TODAS AS 5 EMPRESAS
    # =========================================================================
    log("\n" + "="*70)
    log("9. VALIDACAO CRUZADA EM CADA UMA DAS 5 EMPRESAS")
    log("="*70)

    for i in range(5):
        c = companies[i]
        c_name = c["name"]
        jur = users_by_company[c["id"]]["juridico"]
        ti = users_by_company[c["id"]]["ti"]
        uni = users_by_company[c["id"]]["unidade"]

        # Gestor Jurídico da Empresa cria post
        j_tok = login(jur["email"], jur["password"])
        s_p, p_res = create_post_multipart(
            title=f"Informativo Oficial {c_name}",
            content=f"Mensagem corporativa interna exclusiva para colaboradores de {c_name}.",
            company_id=c["id"],
            token=j_tok
        )
        assert_status(s_p, [200, 201], f"[{c_name}] Gestor cria post institucional", p_res)

        # Leitor TI tenta postar -> 403
        t_tok = login(ti["email"], ti["password"])
        s_tf, p_fail = create_post_multipart(
            title="Post Negado",
            content="Conteudo negado",
            company_id=c["id"],
            token=t_tok
        )
        assert_status(s_tf, 403, f"[{c_name}] Leitor TI tenta criar post -> Bloqueado com 403", p_fail)

        # Usuário de unidade visualiza posts da sua empresa
        u_tok = login(uni["email"], uni["password"])
        s_uf, f_res = request("GET", "/api/posts", token=u_tok)
        assert_status(s_uf, 200, f"[{c_name}] Usuario de Unidade visualiza posts da empresa", f_res)
        assert any(f"Informativo Oficial {c_name}" in p["title"] for p in f_res["items"]), f"Post da empresa {c_name} nao encontrado para unidade!"

        # Usuário de unidade tenta acessar dados de outra empresa -> 403
        other_c = companies[(i + 1) % 5]
        s_cr, cross_res = request("GET", f"/api/companies/{other_c['id']}/areas", token=u_tok)
        assert_status(s_cr, 403, f"[{c_name}] Usuario tenta ler Areas de {other_c['name']} -> Bloqueado com 403", cross_res)

    log("\n" + "="*70)
    log("TODAS AS 5 EMPRESAS, 25 AREAS, 25 USUARIOS E REGRAS DE ISOLAMENTO FORAM 100% VALIDADAS!")
    log("="*70)

if __name__ == "__main__":
    main()
