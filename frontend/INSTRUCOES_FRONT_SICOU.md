# Instruções para iniciar o Frontend do Sicou

Este arquivo deve ser anexado em um novo chat para iniciar o desenvolvimento do frontend do Sicou já conhecendo o estado atual do backend, as regras de negócio existentes, a arquitetura utilizada e os cuidados necessários para integração.

---

## 1. Contexto geral do projeto

O **Sicou** é uma plataforma de governança operacional para empresas com estrutura de **sede administrativa** e **unidades**.

A estrutura conceitual atual é:

```txt
Empresa
├── Unidades
└── Áreas da Sede
    ├── Informativos
    ├── Orientador
    └── Workflows
```

A sede cria áreas internas, habilita módulos para cada área e gerencia usuários com permissões granulares. As unidades acessam conteúdos, orientações e futuramente abrem solicitações de workflow para as áreas da sede.

---

## 2. Stack planejada para o frontend

O frontend será desenvolvido com:

```txt
React
TypeScript recomendado
Tailwind CSS
Consumo de ASP.NET Core Web API
JWT Bearer Token
```

Recomendação de arquitetura frontend:

```txt
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
├── shared/
│   ├── api/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── utils/
├── features/
│   ├── auth/
│   ├── companies/
│   ├── units/
│   ├── areas/
│   ├── users/
│   └── access-control/
└── modules/
    ├── informatives/
    ├── guide/
    └── workflows/
```

A ideia é manter no frontend uma organização equivalente à do backend: separação por domínio/feature, service de API isolado, tipos centralizados e telas sem regra de negócio pesada.

---

## 3. Estado atual do backend

O backend está em .NET 8 com ASP.NET Core Web API, Entity Framework Core, Identity, JWT, PostgreSQL e Swagger.

A solução segue arquitetura em camadas:

```txt
Api
↓
Application
↓
Infrastructure
↓
Domain
```

### 3.1 Camada Api

Responsável por:

```txt
Controllers
Rotas HTTP
Autenticação JWT
Autorização por roles e policies
Swagger
Program.cs
```

Controllers atuais:

```txt
AuthController
AdminSetupController
SecurityTestController
CompaniesController
UnitsController
AreasController
UsersController
UserAreaAccessesController
AreaPolicyTestController
```

### 3.2 Camada Application

Responsável por contratos e modelos de entrada/saída:

```txt
Interfaces/Auth
Interfaces/Repositories
Interfaces/Services
Requests
Responses
```

Essa camada não acessa banco diretamente.

### 3.3 Camada Domain

Responsável por entidades, enums e constantes:

```txt
BaseEntity
Company
Unit
Area
Module
AreaModule
UserAreaAccess
SystemRoles
SystemPolicies
ModuleCode
```

### 3.4 Camada Infrastructure

Responsável por implementação técnica:

```txt
ApplicationDbContext
Identity
Repositories
Services
Authorization handlers
Seed de roles
Migrations
JWT
PostgreSQL
```

---

## 4. URL local atual da API

Pelo `launchSettings.json`, a API roda em:

```txt
http://localhost:5175
https://localhost:7299
```

Durante os testes anteriores, foi usado:

```txt
http://localhost:5175
```

Swagger:

```txt
http://localhost:5175/swagger
```

Sugestão para o frontend:

```env
VITE_API_BASE_URL=http://localhost:5175
```

---

## 5. Atenção antes de iniciar o frontend: CORS

No backend atual, **não foi identificada configuração de CORS no Program.cs**.

Antes de conectar o React ao backend, é recomendado adicionar CORS no backend.

Exemplo para desenvolvimento:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
```

E no pipeline, antes de autenticação/autorização:

```csharp
app.UseCors("FrontendDev");

app.UseAuthentication();
app.UseAuthorization();
```

Se o Vite usar outra porta, ajustar o `WithOrigins`.

---

## 6. Autenticação no frontend

O backend usa JWT Bearer Token.

### Login

Endpoint:

```http
POST /api/Auth/login
```

Body:

```json
{
  "email": "admin@sicou.com",
  "password": "Admin123"
}
```

Resposta:

```json
{
  "accessToken": "...",
  "expiresAt": "2026-06-07T18:00:00Z",
  "user": {
    "id": "fbe6359e-994c-49b9-b554-53ecb0ecbe00",
    "fullName": "Administrador Sicou",
    "email": "admin@sicou.com",
    "isActive": true,
    "companyId": null,
    "unitId": null,
    "roles": [
      "SUPER_ADMIN"
    ]
  }
}
```

No frontend, salvar:

```txt
accessToken
expiresAt
user
```

Recomendação inicial:

```txt
localStorage para desenvolvimento
AuthContext/Zustand para estado global
Interceptor/fetch wrapper para enviar Authorization
```

Header obrigatório em endpoints protegidos:

```http
Authorization: Bearer SEU_TOKEN
```

### Usuário atual

Endpoint:

```http
GET /api/Auth/me
```

Requer token.

Uso no frontend:

```txt
Validar sessão ao recarregar a aplicação
Reconstruir usuário autenticado
Controlar menu e permissões visuais
```

---

## 7. Roles existentes

As roles ficam centralizadas no backend em `SystemRoles.cs`.

```txt
SUPER_ADMIN
COMPANY_ADMIN
AREA_ADMIN
HEADQUARTER_USER
UNIT_USER
```

### Significado para o frontend

```txt
SUPER_ADMIN
Acesso global ao sistema. Pode administrar empresas, unidades, áreas, usuários e permissões.

COMPANY_ADMIN
Administrador de uma empresa. Deve administrar usuários e recursos da própria empresa. Observação: backend ainda precisa refinar policies para impedir acesso entre empresas.

AREA_ADMIN
Administrador de uma área da sede. Vai ser usado principalmente nos módulos futuros.

HEADQUARTER_USER
Usuário operacional da sede.

UNIT_USER
Usuário operacional de uma unidade.
```

O frontend deve usar roles para:

```txt
Montar menus
Proteger rotas visualmente
Exibir/esconder botões
Direcionar usuário após login
```

Mas a segurança real sempre deve ficar no backend.

---

## 8. Policies e permissões granulares

O backend já possui policies por área, centralizadas em `SystemPolicies.cs`:

```txt
CanManageCompany
CanManageArea
CanViewArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

Atualmente foram registradas e testadas as policies por `areaId`:

```txt
CanViewArea
CanManageArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

Existe um controller temporário para teste:

```txt
AreaPolicyTestController
```

Endpoints de teste:

```http
GET /api/area-policy-test/{areaId}/can-view
GET /api/area-policy-test/{areaId}/can-manage
GET /api/area-policy-test/{areaId}/can-publish-informative
GET /api/area-policy-test/{areaId}/can-manage-guide
GET /api/area-policy-test/{areaId}/can-manage-workflow
GET /api/area-policy-test/{areaId}/can-handle-workflow
```

Com `SUPER_ADMIN`, todos retornaram `200 OK`.

Importante para o frontend:

```txt
As permissões granulares ficam em UserAreaAccess.
Um usuário pode ter acesso a várias áreas.
Cada registro representa uma combinação de usuário + empresa + unidade opcional + área.
```

---

## 9. Entidades principais já existentes

### Company

Representa uma empresa.

Campos de resposta:

```ts
interface CompanyResponse {
  id: string;
  name: string;
  document?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}
```

### Unit

Representa uma unidade vinculada a uma empresa.

```ts
interface UnitResponse {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}
```

### Area

Representa uma área da sede dentro da empresa.

```ts
interface AreaResponse {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
  modules: AreaModuleResponse[];
}

interface AreaModuleResponse {
  moduleId: string;
  code: 'Informatives' | 'Guide' | 'Workflows';
  name: string;
  enabled: boolean;
}
```

### User

```ts
interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  companyId?: string | null;
  unitId?: string | null;
  roles: string[];
  createdAt: string;
  updatedAt?: string | null;
}
```

### UserAreaAccess

```ts
interface UserAreaAccessResponse {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  unitId?: string | null;
  unitName?: string | null;
  areaId: string;
  areaName: string;
  canView: boolean;
  canManage: boolean;
  canPublishInformatives: boolean;
  canManageGuide: boolean;
  canManageWorkflows: boolean;
  canHandleWorkflowRequests: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}
```

---

## 10. Endpoints disponíveis para o frontend

### Auth

```http
POST /api/Auth/register
POST /api/Auth/login
GET  /api/Auth/me
```

Observação: `register` existe, mas para criação administrativa de usuários o frontend deve priorizar `POST /api/users`.

---

### Companies

Proteção atual:

```txt
SUPER_ADMIN
```

Endpoints:

```http
POST   /api/companies
GET    /api/companies
GET    /api/companies/{id}
PUT    /api/companies/{id}
DELETE /api/companies/{id}
```

Create:

```ts
interface CreateCompanyRequest {
  name: string;
  document?: string | null;
}
```

Update:

```ts
interface UpdateCompanyRequest {
  name: string;
  document?: string | null;
  isActive: boolean;
}
```

---

### Units

Proteção atual:

```txt
SUPER_ADMIN
```

Endpoints:

```http
POST   /api/companies/{companyId}/units
GET    /api/companies/{companyId}/units
GET    /api/units/{id}
PUT    /api/units/{id}
DELETE /api/units/{id}
```

Create:

```ts
interface CreateUnitRequest {
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
}
```

Update:

```ts
interface UpdateUnitRequest {
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  isActive: boolean;
}
```

---

### Areas

Proteção atual:

```txt
SUPER_ADMIN
```

Endpoints:

```http
POST   /api/companies/{companyId}/areas
GET    /api/companies/{companyId}/areas
GET    /api/areas/{id}
PUT    /api/areas/{id}
PUT    /api/areas/{id}/modules
DELETE /api/areas/{id}
```

Create:

```ts
interface CreateAreaRequest {
  name: string;
  description?: string | null;
  moduleCodes: ModuleCode[];
}

type ModuleCode = 'Informatives' | 'Guide' | 'Workflows';
```

Update:

```ts
interface UpdateAreaRequest {
  name: string;
  description?: string | null;
  isActive: boolean;
}
```

Update modules:

```ts
interface UpdateAreaModulesRequest {
  moduleCodes: ModuleCode[];
}
```

---

### Users

Proteção atual:

```txt
SUPER_ADMIN
COMPANY_ADMIN
```

Endpoints:

```http
POST   /api/users
GET    /api/users
GET    /api/users/{id}
PUT    /api/users/{id}
DELETE /api/users/{id}
PUT    /api/users/{id}/roles
```

Create:

```ts
interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  companyId?: string | null;
  unitId?: string | null;
  roles: string[];
}
```

Update:

```ts
interface UpdateUserRequest {
  fullName: string;
  companyId?: string | null;
  unitId?: string | null;
  isActive: boolean;
}
```

Update roles:

```ts
interface UpdateUserRolesRequest {
  roles: string[];
}
```

---

### User Area Accesses

Proteção atual:

```txt
SUPER_ADMIN
COMPANY_ADMIN
```

Endpoints:

```http
POST   /api/user-area-accesses
GET    /api/user-area-accesses/{id}
GET    /api/user-area-accesses/by-user/{userId}
GET    /api/user-area-accesses/by-company/{companyId}
PUT    /api/user-area-accesses/{id}
DELETE /api/user-area-accesses/{id}
```

Create:

```ts
interface CreateUserAreaAccessRequest {
  userId: string;
  companyId: string;
  unitId?: string | null;
  areaId: string;
  canView: boolean;
  canManage: boolean;
  canPublishInformatives: boolean;
  canManageGuide: boolean;
  canManageWorkflows: boolean;
  canHandleWorkflowRequests: boolean;
}
```

Update:

```ts
interface UpdateUserAreaAccessRequest {
  canView: boolean;
  canManage: boolean;
  canPublishInformatives: boolean;
  canManageGuide: boolean;
  canManageWorkflows: boolean;
  canHandleWorkflowRequests: boolean;
}
```

---

## 11. Fluxos que o frontend já pode implementar

### 11.1 Login e sessão

```txt
Tela de login
Salvar token
Buscar /api/Auth/me
Logout
Proteção de rotas autenticadas
```

### 11.2 Dashboard administrativo inicial

Para `SUPER_ADMIN`:

```txt
Listar empresas
Criar empresa
Editar empresa
Inativar empresa
Listar unidades por empresa
Criar unidade
Editar unidade
Inativar unidade
Listar áreas por empresa
Criar área com módulos
Editar área
Atualizar módulos da área
Inativar área
```

### 11.3 Gestão de usuários

```txt
Listar usuários
Criar usuário administrativo
Editar dados básicos
Inativar usuário
Atualizar roles
```

### 11.4 Gestão de acessos por área

```txt
Selecionar usuário
Selecionar empresa
Selecionar unidade opcional
Selecionar área
Definir permissões booleanas
Listar acessos por usuário
Listar acessos por empresa
Editar permissões
Inativar acesso
```

### 11.5 Tela de permissões recomendada

Uma tela útil para o Sicou seria:

```txt
Usuários
└── Detalhes do usuário
    ├── Dados básicos
    ├── Roles
    └── Acessos por área
        ├── Empresa
        ├── Unidade opcional
        ├── Área
        ├── Pode visualizar
        ├── Pode gerenciar
        ├── Pode publicar informativos
        ├── Pode gerenciar orientador
        ├── Pode gerenciar workflows
        └── Pode tratar solicitações de workflow
```

---

## 12. Rotas sugeridas para o frontend

```txt
/login
/app
/app/dashboard
/app/companies
/app/companies/:companyId
/app/companies/:companyId/units
/app/companies/:companyId/areas
/app/users
/app/users/:userId
/app/users/:userId/accesses
/app/access-control
```

Quando os módulos forem criados:

```txt
/app/areas/:areaId/informatives
/app/areas/:areaId/guide
/app/areas/:areaId/workflows
```

---

## 13. Menus sugeridos por role

### SUPER_ADMIN

```txt
Dashboard
Empresas
Usuários
Permissões
Teste de Policies, temporário
```

### COMPANY_ADMIN

```txt
Dashboard da empresa
Unidades
Áreas
Usuários da empresa
Permissões da empresa
```

### AREA_ADMIN

```txt
Minha área
Informativos
Orientador
Workflows
```

### HEADQUARTER_USER

```txt
Áreas permitidas
Informativos
Orientador
Workflows internos
```

### UNIT_USER

```txt
Áreas disponíveis
Informativos
Orientador
Abrir solicitações
Minhas solicitações
```

Observação: parte dos menus de módulos depende do backend futuro.

---

## 14. Padrão recomendado para chamada de API no frontend

Criar um client centralizado, por exemplo:

```txt
src/shared/api/httpClient.ts
```

Responsabilidades:

```txt
Ler VITE_API_BASE_URL
Adicionar Authorization Bearer automaticamente
Tratar 401 redirecionando para login
Tratar 403 como acesso negado
Padronizar parse de JSON
Padronizar mensagens de erro
```

Exemplo conceitual:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('sicou.accessToken');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // limpar sessão e redirecionar para login
  }

  if (response.status === 403) {
    throw new Error('Você não tem permissão para executar esta ação.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? 'Erro inesperado na API.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
```

---

## 15. Cuidados importantes de integração

### 15.1 Respostas de erro ainda não são totalmente padronizadas

Alguns controllers retornam:

```json
{
  "message": "..."
}
```

Outros podem retornar erro padrão do ASP.NET Core, por exemplo em `404`:

```json
{
  "type": "...",
  "title": "Not Found",
  "status": 404,
  "traceId": "..."
}
```

O frontend deve tratar os dois formatos.

Futuramente, o backend deve criar middleware global de exceções e padronização de responses.

### 15.2 Não existe refresh token ainda

O backend retorna apenas `accessToken` e `expiresAt`.

O frontend deve:

```txt
Verificar expiresAt
Redirecionar para login quando expirar
Tratar 401 limpando sessão
```

Refresh token fica para melhoria futura.

### 15.3 Soft delete

Deletes não removem fisicamente os registros principais. Eles inativam:

```txt
IsActive = false
UpdatedAt = DateTime.UtcNow
```

Isso vale para:

```txt
Company
Unit
Area
UserAreaAccess
User, via IsActive no Identity
```

No frontend, usar termos como:

```txt
Inativar
Desativar
```

em vez de “Excluir definitivamente”.

### 15.4 Enums de módulos são strings

O backend aceita:

```json
{
  "moduleCodes": ["Informatives", "Guide", "Workflows"]
}
```

Não enviar números.

### 15.5 AreaPolicyTestController é temporário

Pode ser usado durante desenvolvimento para validar permissões, mas não deve virar parte da interface final.

---

## 16. O frontend pode começar agora?

Sim, **é uma boa ideia iniciar o frontend agora**, desde que o objetivo inicial seja construir a base administrativa e não os módulos finais.

O backend já tem uma fundação suficiente para o frontend começar:

```txt
Autenticação JWT funcionando
Usuário atual via /api/Auth/me
Roles funcionando
CRUD de empresas
CRUD de unidades
CRUD de áreas
Módulos habilitados por área
CRUD administrativo de usuários
Acessos granulares por área
Policies por área testadas
Swagger funcional
```

Isso permite construir com segurança:

```txt
Login
Layout autenticado
Dashboard inicial
Gestão de empresas
Gestão de unidades
Gestão de áreas
Gestão de usuários
Gestão de permissões por área
Controle visual por role
```

Mas ainda **não é recomendado iniciar telas completas de Informativos, Orientador e Workflows**, porque esses módulos ainda não existem no backend.

O ideal é começar o frontend com esta ordem:

```txt
1. Setup React + Tailwind + roteamento
2. Auth/login/logout/me
3. Layout administrativo protegido
4. CRUD de empresas
5. CRUD de unidades
6. CRUD de áreas e módulos
7. CRUD de usuários
8. Gestão de acessos granulares
9. Guards visuais por role/permissão
10. Depois iniciar módulo de Informativos quando backend Etapa 13 estiver pronto
```

---

## 17. Próximos passos recomendados no backend antes/durante o frontend

Para facilitar a integração com React, recomenda-se no backend:

```txt
1. Adicionar CORS para http://localhost:5173
2. Padronizar erro global com middleware
3. Criar response padrão para validação/erros
4. Criar paginação em listas grandes, principalmente users e companies
5. Criar endpoint para consultar permissões efetivas do usuário logado
6. Refinar policies de COMPANY_ADMIN para limitar acesso à própria empresa
7. Remover ou proteger AdminSetupController
8. Remover AreaPolicyTestController quando os módulos reais usarem policies
9. Implementar refresh token futuramente
10. Criar módulo de Informativos como próxima grande etapa do backend
```

Endpoint muito útil para o frontend futuramente:

```http
GET /api/Auth/me/permissions
```

Resposta sugerida:

```json
{
  "userId": "...",
  "roles": ["UNIT_USER"],
  "companyId": "...",
  "unitId": "...",
  "areaAccesses": [
    {
      "areaId": "...",
      "areaName": "Jurídico",
      "canView": true,
      "canManage": false,
      "canPublishInformatives": false,
      "canManageGuide": true,
      "canManageWorkflows": false,
      "canHandleWorkflowRequests": true
    }
  ]
}
```

Esse endpoint evitaria o frontend fazer várias chamadas para montar menu e permissões.

---

## 18. Resumo para o próximo chat

Use este resumo como primeira mensagem se quiser iniciar outro chat:

```txt
Estou desenvolvendo o projeto Sicou.

Backend atual:
- .NET 8
- ASP.NET Core Web API
- Entity Framework Core
- Identity
- JWT
- PostgreSQL
- Swagger
- Solution em camadas: Api, Application, Domain, Infrastructure
- Repository Pattern e Service Layer aplicados
- Roles: SUPER_ADMIN, COMPANY_ADMIN, AREA_ADMIN, HEADQUARTER_USER, UNIT_USER
- SystemPolicies criadas: CanManageCompany, CanManageArea, CanViewArea, CanPublishInformative, CanManageGuide, CanManageWorkflow, CanHandleWorkflow
- CRUD de Company funcionando
- CRUD de Unit funcionando
- CRUD de Area funcionando com módulos habilitados
- Entidades: Company, Unit, Area, Module, AreaModule, UserAreaAccess
- Módulos iniciais: Informatives, Guide, Workflows
- CRUD administrativo de usuários funcionando em /api/users
- CRUD de permissões granulares funcionando em /api/user-area-accesses
- Policies por área funcionando e testadas em /api/area-policy-test/{areaId}/...
- JWT deve ser enviado no frontend como Authorization: Bearer {token}
- API local: http://localhost:5175
- Swagger: http://localhost:5175/swagger

Quero iniciar o frontend com React + Tailwind, integrando com esse backend.
Quero seguir uma arquitetura organizada por features, com services de API, AuthContext, rotas protegidas e controle visual por roles/permissões.
Antes de conectar, preciso garantir CORS no backend para http://localhost:5173.
O frontend deve começar por login, sessão, layout administrativo, CRUD de empresas, unidades, áreas, usuários e acessos granulares.
Ainda não devo criar telas finais de Informativos, Orientador e Workflows porque esses módulos ainda serão implementados no backend.
```

---

## 19. Decisão final

Começar o frontend agora é uma boa decisão porque o backend já tem um núcleo administrativo real para integração.

Apenas mantenha a estratégia correta:

```txt
Frontend agora:
base, autenticação, administração e permissões.

Backend em paralelo:
CORS, padronização de erros, endpoint de permissões efetivas e depois módulo de Informativos.
```

Assim o projeto evolui de forma incremental sem travar o frontend esperando todos os módulos finais ficarem prontos.
