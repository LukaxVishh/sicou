import json
import urllib.request
import urllib.error
import sys

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"

def make_request(url, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except:
            parsed = {"raw": content}
        return e.code, parsed
    except Exception as e:
        return 500, {"error": str(e)}

def main():
    print("=" * 70)
    print("[SICOU] CRIANDO MATRIZ COMPLETA DE ACESSOS E USUARIOS")
    print("=" * 70)

    # 1. Login SuperAdmin
    print("\n1. Autenticando Super Admin...")
    status, res = make_request(f"{BASE_URL}/api/auth/login", method="POST", data={
        "email": "admin@sicou.com",
        "password": "Admin123"
    })
    if status != 200:
        print(f"Erro ao autenticar SuperAdmin: {status} {res}")
        sys.exit(1)
    admin_token = res["accessToken"]
    print("  + SuperAdmin autenticado.")

    # 2. Criar ou Obter Empresa "Cooperativa Aurora Central"
    print("\n2. Configurando Empresa...")
    status, companies = make_request(f"{BASE_URL}/api/companies", token=admin_token)
    company = next((c for c in companies if c["name"] == "Cooperativa Aurora Central"), None)
    if not company:
        status, company = make_request(f"{BASE_URL}/api/companies", method="POST", data={
            "name": "Cooperativa Aurora Central",
            "document": "12.345.678/0001-90"
        }, token=admin_token)
        print(f"  + Empresa criada: {company['name']} (ID: {company['id']})")
    else:
        print(f"  + Empresa ja existente: {company['name']} (ID: {company['id']})")
    company_id = company["id"]

    # 3. Criar 3 Unidades
    print("\n3. Configurando 3 Unidades...")
    units_def = [
        {"name": "Unidade 01 - Cascavel", "document": "12.345.678/0002-71", "code": "UNID-CSC"},
        {"name": "Unidade 02 - Toledo", "document": "12.345.678/0003-52", "code": "UNID-TLD"},
        {"name": "Unidade 03 - Foz do Iguacu", "document": "12.345.678/0004-33", "code": "UNID-FOZ"},
    ]
    status, existing_units = make_request(f"{BASE_URL}/api/companies/{company_id}/units", token=admin_token)
    units_map = {}
    for u_def in units_def:
        u_obj = next((u for u in existing_units if u["name"] == u_def["name"]), None)
        if not u_obj:
            status, u_obj = make_request(f"{BASE_URL}/api/companies/{company_id}/units", method="POST", data=u_def, token=admin_token)
            print(f"  + Unidade criada: {u_obj['name']} (ID: {u_obj['id']})")
        else:
            print(f"  + Unidade existente: {u_obj['name']} (ID: {u_obj['id']})")
        units_map[u_def["name"]] = u_obj["id"]

    # 4. Criar 3 Areas da Sede (sem modulos)
    print("\n4. Configurando 3 Areas da Sede...")
    areas_def = [
        {"name": "Juridico & Compliance", "slug": "juridico-compliance", "description": "Gestao juridica e regulatoria da cooperativa"},
        {"name": "Recursos Humanos", "slug": "recursos-humanos", "description": "Gestao de pessoas, DP e cultura organizacional"},
        {"name": "Financeiro & Contabil", "slug": "financeiro-contabil", "description": "Controladoria, contas e operacoes financeiras"},
    ]
    status, existing_areas = make_request(f"{BASE_URL}/api/companies/{company_id}/areas", token=admin_token)
    areas_map = {}
    for a_def in areas_def:
        a_obj = next((a for a in existing_areas if a["name"] == a_def["name"]), None)
        if not a_obj:
            status, a_obj = make_request(f"{BASE_URL}/api/companies/{company_id}/areas", method="POST", data=a_def, token=admin_token)
            print(f"  + Area criada: {a_obj['name']} (ID: {a_obj['id']})")
        else:
            print(f"  + Area existente: {a_obj['name']} (ID: {a_obj['id']})")
        areas_map[a_def["name"]] = a_obj["id"]

    # 5. Criar Usuarios
    print("\n5. Criando Usuarios da Matriz...")
    status, existing_users = make_request(f"{BASE_URL}/api/users", token=admin_token)

    users_to_create = [
        # Administrador da Empresa
        {
            "fullName": "Administrador Cooperativa Aurora",
            "email": "admin.aurora@sicou.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": None,
            "roles": ["COMPANY_ADMIN"],
            "areaAccess": None
        },
        # Area 1: Juridico
        {
            "fullName": "Gestor Juridico",
            "email": "gestor.juridico@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": None,
            "roles": ["HEADQUARTER_USER"],
            "areaAccess": {
                "areaName": "Juridico & Compliance",
                "canView": True,
                "canManage": True,
                "canManageWorkflows": True,
                "canHandleWorkflowRequests": True,
                "canPublishInformatives": True,
                "canManageGuide": True
            }
        },
        {
            "fullName": "Analista Juridico",
            "email": "analista.juridico@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": None,
            "roles": ["HEADQUARTER_USER"],
            "areaAccess": {
                "areaName": "Juridico & Compliance",
                "canView": True,
                "canManage": False,
                "canManageWorkflows": False,
                "canHandleWorkflowRequests": False,
                "canPublishInformatives": False,
                "canManageGuide": False
            }
        },
        # Area 2: Recursos Humanos
        {
            "fullName": "Gestor Recursos Humanos",
            "email": "gestor.rh@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": None,
            "roles": ["HEADQUARTER_USER"],
            "areaAccess": {
                "areaName": "Recursos Humanos",
                "canView": True,
                "canManage": True,
                "canManageWorkflows": True,
                "canHandleWorkflowRequests": True,
                "canPublishInformatives": True,
                "canManageGuide": True
            }
        },
        {
            "fullName": "Analista Recursos Humanos",
            "email": "analista.rh@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": None,
            "roles": ["HEADQUARTER_USER"],
            "areaAccess": {
                "areaName": "Recursos Humanos",
                "canView": True,
                "canManage": False,
                "canManageWorkflows": False,
                "canHandleWorkflowRequests": False,
                "canPublishInformatives": False,
                "canManageGuide": False
            }
        },
        # Area 3: Financeiro
        {
            "fullName": "Gestor Financeiro",
            "email": "gestor.financeiro@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": None,
            "roles": ["HEADQUARTER_USER"],
            "areaAccess": {
                "areaName": "Financeiro & Contabil",
                "canView": True,
                "canManage": True,
                "canManageWorkflows": True,
                "canHandleWorkflowRequests": True,
                "canPublishInformatives": True,
                "canManageGuide": True
            }
        },
        {
            "fullName": "Analista Financeiro",
            "email": "analista.financeiro@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": None,
            "roles": ["HEADQUARTER_USER"],
            "areaAccess": {
                "areaName": "Financeiro & Contabil",
                "canView": True,
                "canManage": False,
                "canManageWorkflows": False,
                "canHandleWorkflowRequests": False,
                "canPublishInformatives": False,
                "canManageGuide": False
            }
        },
        # Unidade 1: Cascavel
        {
            "fullName": "Gestor Unidade Cascavel",
            "email": "gestor.cascavel@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": units_map["Unidade 01 - Cascavel"],
            "roles": ["UNIT_USER"],
            "areaAccess": None
        },
        {
            "fullName": "Atendente Unidade Cascavel",
            "email": "atendente.cascavel@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": units_map["Unidade 01 - Cascavel"],
            "roles": ["UNIT_USER"],
            "areaAccess": None
        },
        # Unidade 2: Toledo
        {
            "fullName": "Gestor Unidade Toledo",
            "email": "gestor.toledo@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": units_map["Unidade 02 - Toledo"],
            "roles": ["UNIT_USER"],
            "areaAccess": None
        },
        {
            "fullName": "Atendente Unidade Toledo",
            "email": "atendente.toledo@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": units_map["Unidade 02 - Toledo"],
            "roles": ["UNIT_USER"],
            "areaAccess": None
        },
        # Unidade 3: Foz do Iguacu
        {
            "fullName": "Gestor Unidade Foz",
            "email": "gestor.foz@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": units_map["Unidade 03 - Foz do Iguacu"],
            "roles": ["UNIT_USER"],
            "areaAccess": None
        },
        {
            "fullName": "Atendente Unidade Foz",
            "email": "atendente.foz@aurora.com",
            "password": "Senha@123",
            "companyId": company_id,
            "unitId": units_map["Unidade 03 - Foz do Iguacu"],
            "roles": ["UNIT_USER"],
            "areaAccess": None
        },
    ]

    status, accesses_by_company = make_request(f"{BASE_URL}/api/user-area-accesses/by-company/{company_id}", token=admin_token)
    if not isinstance(accesses_by_company, list):
        accesses_by_company = []

    for u_info in users_to_create:
        existing = next((u for u in existing_users if u["email"].lower() == u_info["email"].lower()), None)
        user_id = None
        if not existing:
            status, created_user = make_request(f"{BASE_URL}/api/users", method="POST", data={
                "fullName": u_info["fullName"],
                "email": u_info["email"],
                "password": u_info["password"],
                "companyId": u_info["companyId"],
                "unitId": u_info["unitId"],
                "roles": u_info["roles"]
            }, token=admin_token)
            if status in [200, 201]:
                user_id = created_user["id"]
                print(f"  + Usuario criado: {u_info['email']} (ID: {user_id})")
            else:
                print(f"  - Erro ao criar {u_info['email']}: {status} {created_user}")
        else:
            user_id = existing["id"]
            print(f"  + Usuario ja existente: {u_info['email']} (ID: {user_id})")

        # Configurar UserAreaAccess se aplicavel
        if user_id and u_info["areaAccess"]:
            acc_def = u_info["areaAccess"]
            target_area_id = areas_map[acc_def["areaName"]]
            
            existing_acc = next((a for a in accesses_by_company if a["userId"] == user_id and a["areaId"] == target_area_id), None)
            if not existing_acc:
                status, acc_res = make_request(f"{BASE_URL}/api/user-area-accesses", method="POST", data={
                    "userId": user_id,
                    "companyId": company_id,
                    "unitId": None,
                    "areaId": target_area_id,
                    "canView": acc_def["canView"],
                    "canManage": acc_def["canManage"],
                    "canPublishInformatives": acc_def["canPublishInformatives"],
                    "canManageGuide": acc_def["canManageGuide"],
                    "canManageWorkflows": acc_def["canManageWorkflows"],
                    "canHandleWorkflowRequests": acc_def["canHandleWorkflowRequests"]
                }, token=admin_token)
                print(f"    -> Acesso na area '{acc_def['areaName']}' vinculado! canManage={acc_def['canManage']}")
            else:
                status, acc_res = make_request(f"{BASE_URL}/api/user-area-accesses/{existing_acc['id']}", method="PUT", data={
                    "canView": acc_def["canView"],
                    "canManage": acc_def["canManage"],
                    "canPublishInformatives": acc_def["canPublishInformatives"],
                    "canManageGuide": acc_def["canManageGuide"],
                    "canManageWorkflows": acc_def["canManageWorkflows"],
                    "canHandleWorkflowRequests": acc_def["canHandleWorkflowRequests"]
                }, token=admin_token)
                print(f"    -> Acesso na area '{acc_def['areaName']}' atualizado! canManage={acc_def['canManage']}")

    # 6. Validar autenticacao de todos os usuarios criados
    print("\n6. Validando logins de todos os perfis...")
    all_logins = [{"email": "admin@sicou.com", "password": "Admin123", "role": "SUPER_ADMIN"}]
    for u in users_to_create:
        all_logins.append({"email": u["email"], "password": u["password"], "role": u["roles"][0]})

    success_count = 0
    for l in all_logins:
        st, res = make_request(f"{BASE_URL}/api/auth/login", method="POST", data={
            "email": l["email"],
            "password": l["password"]
        })
        if st == 200:
            success_count += 1
            print(f"  [OK] Login bem-sucedido: {l['email']} ({l['role']})")
        else:
            print(f"  [FALHA] Login falhou para {l['email']}: {st} {res}")

    print("\n" + "=" * 70)
    print(f"MATRIZ CRIADA COM SUCESSO: {success_count}/{len(all_logins)} USUARIOS VALIDADOS E PRONTOS!")
    print("=" * 70)

if __name__ == "__main__":
    main()
