import urllib.request
import urllib.error
import json
import time
import sys

BASE_URL = "http://localhost:8080"

def log(msg):
    print(f"[SYNC-ENGINE] {msg}")

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

def login(email, password):
    status, res = request("POST", "/api/auth/login", {"email": email, "password": password})
    if status != 200:
        raise Exception(f"Failed to login with {email}: {res}")
    return res["accessToken"]

def main():
    log("========================================================================")
    log("AUDITORIA E SINCRONIZACAO COMPLETA DE REGISTROS EM TODAS AS EMPRESAS")
    log("========================================================================")

    super_token = login("admin@sicou.com", "Admin123")

    # 1. Obter todas as empresas
    s_c, companies = request("GET", "/api/companies", token=super_token)
    if s_c != 200 or not companies:
        log("Nenhuma empresa encontrada. Criando 5 empresas padrão...")
        companies = []
        comp_seeds = [
            ("Sicou Cooperativa Central Matriz", "11.222.333/0001-44"),
            ("Agroindústria Regional Sul", "22.333.444/0001-55"),
            ("Logística e Transportes Integrados", "33.444.555/0001-66"),
            ("Cooperativa de Crédito Pioneira", "44.555.666/0001-77"),
            ("Tecnologia e Gestão Corporativa", "55.666.777/0001-88"),
        ]
        for name, doc in comp_seeds:
            _, new_c = request("POST", "/api/companies", {"name": name, "document": doc}, token=super_token)
            companies.append(new_c)

    log(f"Total de empresas no sistema: {len(companies)}")

    # Áreas padrão da sede
    standard_areas = [
        ("Jurídico", "Gestão de contratos, conformidade legal e governança"),
        ("Recursos Humanos", "Gestão de pessoas, capacitação, admissões e benefícios"),
        ("Tecnologia da Informação", "Infraestrutura de TI, sistemas e segurança de dados"),
        ("Controladoria e Finanças", "Planejamento orçamentário, auditoria e contas"),
        ("Operações e Logística", "Rotinas operacionais, distribuição e atendimento às filiais"),
    ]

    for idx, comp in enumerate(companies, start=1):
        c_id = comp["id"]
        c_name = comp["name"]
        log(f"\n--- Sincronizando Empresa [{idx}/{len(companies)}]: {c_name} ({c_id}) ---")

        # A. Sincronizar Unidades
        _, existing_units = request("GET", f"/api/companies/{c_id}/units", token=super_token)
        existing_unit_names = [u["name"] for u in (existing_units or [])]

        target_units = [
            (f"Agência Centro - {c_name}", f"AG{idx:02d}1", "Curitiba", "PR"),
            (f"Agência Norte - {c_name}", f"AG{idx:02d}2", "Londrina", "PR"),
            (f"Posto Regional - {c_name}", f"PAC{idx:02d}", "Cascavel", "PR"),
        ]

        current_units = list(existing_units or [])
        for u_name, u_code, u_city, u_state in target_units:
            if not any(u_name == ex["name"] for ex in current_units):
                s, new_u = request("POST", f"/api/companies/{c_id}/units", {
                    "name": u_name,
                    "code": u_code,
                    "city": u_city,
                    "state": u_state
                }, token=super_token)
                if s in [200, 201]:
                    log(f"  + Unidade criada: {u_name} ({u_code})")
                    current_units.append(new_u)

        # B. Sincronizar Áreas da Sede
        _, existing_areas = request("GET", f"/api/companies/{c_id}/areas", token=super_token)
        current_areas = list(existing_areas or [])

        for a_name, a_desc in standard_areas:
            full_a_name = f"{a_name}"
            if not any(a["name"] == full_a_name or a_name in a["name"] for a in current_areas):
                s, new_a = request("POST", f"/api/companies/{c_id}/areas", {
                    "name": full_a_name,
                    "description": a_desc,
                    "moduleCodes": ["Informatives", "Guide", "Workflows"]
                }, token=super_token)
                if s in [200, 201]:
                    log(f"  + Área criada: {full_a_name}")
                    current_areas.append(new_a)

        # C. Sincronizar Usuários da Empresa
        _, all_users = request("GET", "/api/users", token=super_token)
        comp_users = [u for u in (all_users or []) if u.get("companyId") == c_id]

        primary_unit_id = current_units[0]["id"] if current_units else None

        target_users = [
            (f"Admin {c_name}", f"admin.c{idx}@sicou.com", ["COMPANY_ADMIN"], None),
            (f"Gestor Jurídico {idx}", f"juridico.c{idx}@sicou.com", ["HEADQUARTER_USER"], None),
            (f"Publicador RH {idx}", f"rh.c{idx}@sicou.com", ["HEADQUARTER_USER"], None),
            (f"Analista TI {idx}", f"ti.c{idx}@sicou.com", ["HEADQUARTER_USER"], None),
            (f"Atendente Filial {idx}", f"unidade.c{idx}@sicou.com", ["UNIT_USER"], primary_unit_id),
        ]

        active_comp_users = {}
        for u_fullname, u_email, u_roles, u_unit in target_users:
            found = next((u for u in comp_users if u["email"] == u_email), None)
            if not found:
                s, new_user = request("POST", "/api/users", {
                    "fullName": u_fullname,
                    "email": u_email,
                    "password": "Password123!",
                    "companyId": c_id,
                    "unitId": u_unit,
                    "roles": u_roles
                }, token=super_token)
                if s in [200, 201]:
                    log(f"  + Usuário criado: {u_fullname} ({u_email}) - {u_roles[0]}")
                    active_comp_users[u_roles[0]] = new_user
                    comp_users.append(new_user)
            else:
                active_comp_users[u_roles[0]] = found

        # D. Sincronizar Permissões Granulares (UserAreaAccess)
        _, existing_accesses = request("GET", f"/api/user-area-accesses/by-company/{c_id}", token=super_token)
        current_accesses = list(existing_accesses or [])

        # Identificar áreas específicas
        jur_area = next((a for a in current_areas if "Jurídico" in a["name"] or "Juridico" in a["name"]), current_areas[0] if current_areas else None)
        rh_area = next((a for a in current_areas if "Recursos Humanos" in a["name"] or "RH" in a["name"]), current_areas[1] if len(current_areas) > 1 else None)
        ti_area = next((a for a in current_areas if "Tecnologia" in a["name"] or "TI" in a["name"]), current_areas[2] if len(current_areas) > 2 else None)
        op_area = next((a for a in current_areas if "Operações" in a["name"] or "Operacoes" in a["name"]), current_areas[-1] if current_areas else None)

        jur_user = next((u for u in comp_users if "juridico" in u["email"]), None)
        rh_user = next((u for u in comp_users if "rh" in u["email"]), None)
        ti_user = next((u for u in comp_users if "ti" in u["email"]), None)
        uni_user = next((u for u in comp_users if "unidade" in u["email"]), None)

        if jur_user and jur_area and not any(acc["userId"] == jur_user["id"] and acc["areaId"] == jur_area["id"] for acc in current_accesses):
            request("POST", "/api/user-area-accesses", {
                "userId": jur_user["id"],
                "companyId": c_id,
                "areaId": jur_area["id"],
                "canView": True,
                "canManage": True,
                "canPublishInformatives": True,
                "canManageGuide": True,
                "canManageWorkflows": True,
                "canHandleWorkflowRequests": True
            }, token=super_token)
            log(f"  + Permissão Total Jurídico configurada para {jur_user['email']}")

        if rh_user and rh_area and not any(acc["userId"] == rh_user["id"] and acc["areaId"] == rh_area["id"] for acc in current_accesses):
            request("POST", "/api/user-area-accesses", {
                "userId": rh_user["id"],
                "companyId": c_id,
                "areaId": rh_area["id"],
                "canView": True,
                "canManage": False,
                "canPublishInformatives": True,
                "canManageGuide": False,
                "canManageWorkflows": False,
                "canHandleWorkflowRequests": False
            }, token=super_token)
            log(f"  + Permissão Publicação RH configurada para {rh_user['email']}")

        if ti_user and ti_area and not any(acc["userId"] == ti_user["id"] and acc["areaId"] == ti_area["id"] for acc in current_accesses):
            request("POST", "/api/user-area-accesses", {
                "userId": ti_user["id"],
                "companyId": c_id,
                "areaId": ti_area["id"],
                "canView": True,
                "canManage": False,
                "canPublishInformatives": False,
                "canManageGuide": False,
                "canManageWorkflows": False,
                "canHandleWorkflowRequests": False
            }, token=super_token)
            log(f"  + Permissão Somente Leitura TI configurada para {ti_user['email']}")

        if uni_user and op_area and not any(acc["userId"] == uni_user["id"] and acc["areaId"] == op_area["id"] for acc in current_accesses):
            request("POST", "/api/user-area-accesses", {
                "userId": uni_user["id"],
                "companyId": c_id,
                "areaId": op_area["id"],
                "unitId": primary_unit_id,
                "canView": True,
                "canManage": False,
                "canPublishInformatives": False,
                "canManageGuide": False,
                "canManageWorkflows": False,
                "canHandleWorkflowRequests": False
            }, token=super_token)
            log(f"  + Permissão Leitura Filial configurada para {uni_user['email']}")

        # E. Sincronizar Publicações no Feed
        _, company_posts = request("GET", f"/api/posts?companyId={c_id}&pageSize=20", token=super_token)
        post_items = company_posts.get("items", []) if isinstance(company_posts, dict) else []

        if jur_user and len(post_items) < 2:
            try:
                j_token = login(jur_user["email"], "Password123!")
                create_post_multipart(
                    title=f"Diretrizes Normativas e Governança - {c_name}",
                    content=f"Comunicado oficial emitido pelo departamento Jurídico para todas as agências e colaboradores de {c_name}. As políticas de conformidade foram atualizadas no orientador.",
                    company_id=c_id,
                    token=j_token
                )
                log(f"  + Publicação do Jurídico criada para {c_name}")
            except Exception as e:
                log(f"  (Aviso post jurídico: {e})")

        if rh_user and len(post_items) < 3:
            try:
                rh_token = login(rh_user["email"], "Password123!")
                create_post_multipart(
                    title=f"Programa de Desenvolvimento e Benefícios - {c_name}",
                    content=f"O departamento de Recursos Humanos informa o cronograma de treinamentos corporativos e o calendário de benefícios para este trimestre em {c_name}.",
                    company_id=c_id,
                    token=rh_token
                )
                log(f"  + Publicação do RH criada para {c_name}")
            except Exception as e:
                log(f"  (Aviso post RH: {e})")

    log("\n========================================================================")
    log("SINCRONIZACAO CONCLUIDA COM SUCESSO EM 100% DAS EMPRESAS DO SISTEMA!")
    log("========================================================================")

if __name__ == "__main__":
    main()
