# Sicou — Contexto atualizado para continuidade do Frontend e Backend

Este arquivo consolida o estado atual do projeto **Sicou** após a preparação mínima do backend para consumo pelo frontend e após o início do frontend em React.

Use este documento como **primeira referência de contexto em um novo chat** para continuar exatamente do ponto atual.

---

## 1. Visão geral do projeto

O **Sicou** é uma plataforma de governança operacional para empresas que possuem uma estrutura de **sede administrativa** e **unidades operacionais**.

A estrutura conceitual do produto é:

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

## 2. Stacks definidas

### Backend

```txt
C#
.NET 8
ASP.NET Core Web API
Entity Framework Core
PostgreSQL
ASP.NET Core Identity
JWT Bearer Token
Swagger
Repository Pattern
Service Layer
Arquitetura em camadas
Padrão MVC via Controllers Web API
```

### Frontend

```txt
React
TypeScript
Vite
Tailwind CSS
React Router
JWT Bearer Token
Arquitetura por features/domínios
Services de API isolados
Tipos centralizados
```

---

## 3. Arquitetura atual do backend

A solução backend segue arquitetura em camadas:

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
Middlewares HTTP
Responses de API
```

Controllers atuais conhecidos:

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

Responsável por:

```txt
Interfaces/Auth
Interfaces/Repositories
Interfaces/Services
Requests
Responses
```

A camada Application define contratos e DTOs, mas não acessa banco diretamente.

### 3.3 Camada Domain

Responsável por:

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

Responsável por:

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
Configurações auxiliares
```

---

## 4. URLs locais

### Backend

```txt
http://localhost:5175
https://localhost:7299
```

Swagger:

```txt
http://localhost:5175/swagger
```

### Frontend

```txt
http://localhost:5173
```

### Variável de ambiente do frontend

Arquivo:

```txt
sicou-front/.env.development
```

Conteúdo:

```env
VITE_API_BASE_URL=http://localhost:5175
```

---

## 5. Ajustes feitos hoje no backend para consumo do frontend

Antes de iniciar o frontend, foi feita uma etapa curta de preparação da API para melhorar o consumo via React.

### 5.1 CORS configurado

Foi criada configuração de CORS permitindo o frontend local em:

```txt
http://localhost:5173
```

A configuração foi centralizada dentro de:

```txt
src/Infrastructure/Configuration/CorsConfiguration.cs
```

A ideia foi manter o `Program.cs` mais limpo, chamando apenas os métodos de configuração.

O backend passou a ter uma policy como:

```txt
FrontendDev
```

E o pipeline deve usar CORS antes de autenticação/autorização:

```csharp
app.UseHttpsRedirection();

app.UseCorsConfiguration();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
```

No `appsettings.Development.json`, foi adicionado o bloco:

```json
{
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:5173"
    ]
  }
}
```

### 5.2 Middleware global de exceções

Foi criada uma estrutura inicial para padronizar erros inesperados:

```txt
src/Api/Responses/ApiErrorResponse.cs
src/Api/Middlewares/ExceptionHandlingMiddleware.cs
```

O middleware trata exceções comuns:

```txt
KeyNotFoundException        -> 404
InvalidOperationException   -> 400
ArgumentException           -> 400
UnauthorizedAccessException -> 403
Exception                   -> 500
```

Formato esperado para erros tratados pelo middleware:

```json
{
  "message": "Mensagem do erro",
  "statusCode": 400,
  "details": null
}
```

Observação importante: alguns controllers ainda retornam manualmente:

```json
{
  "message": "..."
}
```

Isso é aceito pelo frontend atual, porque o `apiFetch` trata tanto `message` quanto `title`, `detail` e `errors`.

### 5.3 Listagens principais filtrando registros ativos

Foram ajustadas listagens padrão para retornar apenas registros ativos.

#### CompanyRepository

`GetAllAsync()` agora filtra:

```csharp
.Where(x => x.IsActive)
```

Resultado:

```txt
GET /api/companies
```

retorna apenas empresas ativas.

#### UnitRepository

`GetByCompanyIdAsync(companyId)` agora filtra unidades ativas:

```csharp
.Where(x => x.CompanyId == companyId && x.IsActive)
```

Resultado:

```txt
GET /api/companies/{companyId}/units
```

retorna apenas unidades ativas.

#### AreaRepository

`GetByCompanyIdAsync(companyId)` agora filtra áreas ativas:

```csharp
.Where(x => x.CompanyId == companyId && x.IsActive)
```

Resultado:

```txt
GET /api/companies/{companyId}/areas
```

retorna apenas áreas ativas.

### 5.4 Ajuste em módulos de áreas

No `AreaRepository`, foi removido filtro dentro do `Include` dos módulos para evitar comportamento inesperado com Include filtrado.

Antes, havia algo como:

```csharp
.Include(x => x.AreaModules.Where(am => am.IsActive && am.Enabled))
```

Agora o repository carrega os módulos, e o filtro é aplicado no mapper do service.

No `AreaService`, o `MapToResponse` passou a retornar apenas módulos:

```csharp
.Where(x => x.IsActive && x.Enabled)
```

Resultado esperado no frontend:

```txt
AreaResponse.Modules
```

só contém módulos ativos e habilitados.

### 5.5 Validação de empresa inativa ao criar unidade

Foi validado que o `UnitService.CreateAsync` já bloqueia criação de unidade em empresa inativa:

```csharp
if (!company.IsActive)
    throw new InvalidOperationException("Não é possível cadastrar unidade para uma empresa inativa.");
```

O `AreaService.CreateAsync` também já possuía validação semelhante para impedir área em empresa inativa.

### 5.6 Validação de usuário ao criar acesso granular

Foi ajustado o `UserAreaAccessService` para validar se o usuário existe e está ativo antes de criar um acesso por área.

Foi injetado:

```csharp
UserManager<ApplicationUser>
```

E adicionadas validações:

```csharp
if (string.IsNullOrWhiteSpace(request.UserId))
    throw new InvalidOperationException("O usuário é obrigatório.");

var user = await _userManager.FindByIdAsync(request.UserId);

if (user is null)
    throw new KeyNotFoundException("Usuário não encontrado.");

if (!user.IsActive)
    throw new InvalidOperationException("Não é possível criar acesso para um usuário inativo.");
```

Também foram melhoradas validações para:

```txt
Empresa inexistente
Empresa inativa
Área inexistente
Área inativa
Área de outra empresa
Unidade inexistente
Unidade inativa
Unidade de outra empresa
```

### 5.7 Reativação de acesso granular inativo

No `UserAreaAccessService.CreateAsync`, foi ajustado o comportamento de duplicidade considerando soft delete.

Regra atual:

```txt
Se já existe acesso ativo:
    retorna erro de duplicidade.

Se já existe acesso inativo:
    reativa o registro antigo, atualiza permissões e retorna o acesso.
```

Isso evita conflito com registros que foram inativados via soft delete.

### 5.8 Endpoint de permissões efetivas foi adiado

Foi discutida a criação de:

```http
GET /api/Auth/me/permissions
```

Mas foi decidido que **não é necessário agora** para iniciar o frontend administrativo.

Esse endpoint será útil no futuro para:

```txt
menus dinâmicos por área
permissões finas por módulo
experiência de UNIT_USER
experiência de AREA_ADMIN
controle por CanPublishInformatives, CanManageGuide, CanManageWorkflows etc.
```

Status:

```txt
Não implementado ainda.
Fica para uma etapa futura.
```

---

## 6. Backend — estado funcional atual

O backend possui:

```txt
Autenticação JWT funcionando
Usuário atual via /api/Auth/me
Roles funcionando
CRUD de Company
CRUD de Unit
CRUD de Area com módulos habilitados
CRUD administrativo de Users
CRUD de UserAreaAccess
Policies por área
Swagger funcional
CORS configurado para React local
Tratamento básico global de exceções
Soft delete em entidades principais
Listagens padrão retornando registros ativos
```

---

## 7. Roles existentes

As roles estão centralizadas no backend em `SystemRoles.cs`:

```txt
SUPER_ADMIN
COMPANY_ADMIN
AREA_ADMIN
HEADQUARTER_USER
UNIT_USER
```

### Uso no frontend

O frontend usa roles para:

```txt
montar menu
proteger rotas visualmente
exibir/esconder botões
direcionar usuário após login
```

A segurança real permanece no backend.

---

## 8. Policies existentes

As policies atuais em `SystemPolicies.cs` são:

```txt
CanManageCompany
CanManageArea
CanViewArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

As policies por área funcionam usando `areaId` na rota e `UserAreaAccess`.

O controller temporário `AreaPolicyTestController` ainda existe para testes, mas não deve virar parte da interface final.

---

## 9. Endpoints disponíveis e usados pelo frontend

### Auth

```http
POST /api/Auth/login
GET  /api/Auth/me
```

`POST /api/Auth/register` existe, mas o frontend administrativo deve priorizar criação via:

```http
POST /api/users
```

### Companies

```http
POST   /api/companies
GET    /api/companies
GET    /api/companies/{id}
PUT    /api/companies/{id}
DELETE /api/companies/{id}
```

Status no frontend:

```txt
Listar: implementado
Criar: implementado
Editar: implementado
Inativar: implementado
Detalhar: implementado
```

### Units

```http
POST   /api/companies/{companyId}/units
GET    /api/companies/{companyId}/units
GET    /api/units/{id}
PUT    /api/units/{id}
DELETE /api/units/{id}
```

Status no frontend:

```txt
Listar por empresa: implementado
Criar por empresa: implementado
Editar: pendente
Inativar: pendente
Detalhar: pendente/opcional
```

### Areas

```http
POST   /api/companies/{companyId}/areas
GET    /api/companies/{companyId}/areas
GET    /api/areas/{id}
PUT    /api/areas/{id}
PUT    /api/areas/{id}/modules
DELETE /api/areas/{id}
```

Status no frontend:

```txt
Ainda não implementado.
Existe placeholder na página de detalhes da empresa.
```

### Users

```http
POST   /api/users
GET    /api/users
GET    /api/users/{id}
PUT    /api/users/{id}
DELETE /api/users/{id}
PUT    /api/users/{id}/roles
```

Status no frontend:

```txt
Ainda não implementado.
Existe menu e rota placeholder.
```

### User Area Accesses

```http
POST   /api/user-area-accesses
GET    /api/user-area-accesses/{id}
GET    /api/user-area-accesses/by-user/{userId}
GET    /api/user-area-accesses/by-company/{companyId}
PUT    /api/user-area-accesses/{id}
DELETE /api/user-area-accesses/{id}
```

Status no frontend:

```txt
Ainda não implementado.
Existe menu e rota placeholder.
```

---

## 10. Entidades e tipos principais

### Company

```ts
export type Company = {
  id: string;
  name: string;
  document?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

export type CreateCompanyRequest = {
  name: string;
  document?: string | null;
};

export type UpdateCompanyRequest = {
  name: string;
  document?: string | null;
  isActive: boolean;
};
```

### Unit

```ts
export type Unit = {
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
};

export type CreateUnitRequest = {
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
};

export type UpdateUnitRequest = {
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  isActive: boolean;
};
```

### Area

```ts
export type ModuleCode = 'Informatives' | 'Guide' | 'Workflows';

export type AreaModule = {
  moduleId: string;
  code: ModuleCode;
  name: string;
  enabled: boolean;
};

export type Area = {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
  modules: AreaModule[];
};
```

### Auth

```ts
export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  companyId?: string | null;
  unitId?: string | null;
  roles: SystemRole[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
};
```

---

## 11. Frontend — projeto criado hoje

O frontend foi criado em:

```txt
C:\Users\kinha\sicou\frontend\sicou-front
```

Com o comando:

```bash
npm create vite@latest sicou-front -- --template react-ts
```

Dependências instaladas:

```bash
npm install react-router lucide-react clsx tailwind-merge
npm install tailwindcss @tailwindcss/vite
```

O Vite está rodando em:

```txt
http://localhost:5173
```

---

## 12. Frontend — estrutura atual de pastas

Estrutura planejada/criada:

```txt
src/
├── app/
│   ├── config/
│   ├── layouts/
│   ├── pages/
│   ├── providers/
│   └── router/
├── shared/
│   ├── api/
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── lib/
│   ├── schemas/
│   ├── stores/
│   ├── types/
│   ├── utils/
│   └── api/
├── features/
│   ├── auth/
│   │   ├── api/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── providers/
│   │   └── types/
│   ├── companies/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   └── types/
│   ├── units/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   └── types/
│   ├── areas/
│   ├── users/
│   └── access-control/
└── modules/
    ├── informatives/
    ├── guide/
    └── workflows/
```

Observação: `areas`, `users`, `access-control` e `modules` ainda estão preparados como estrutura, mas não implementados visualmente além dos placeholders.

---

## 13. Frontend — arquivos base criados

### Configuração de ambiente

Arquivo:

```txt
src/app/config/env.ts
```

Responsável por ler:

```txt
VITE_API_BASE_URL
```

### Storage keys

Arquivo:

```txt
src/shared/constants/storageKeys.ts
```

Chaves usadas:

```txt
sicou.accessToken
sicou.expiresAt
sicou.user
```

### Roles no frontend

Arquivo:

```txt
src/shared/constants/roles.ts
```

Roles:

```txt
SUPER_ADMIN
COMPANY_ADMIN
AREA_ADMIN
HEADQUARTER_USER
UNIT_USER
```

### Utilitário de classes

Arquivo:

```txt
src/shared/utils/cn.ts
```

Usa:

```txt
clsx
tailwind-merge
```

---

## 14. Frontend — client HTTP centralizado

Arquivo:

```txt
src/shared/api/apiFetch.ts
```

Responsabilidades:

```txt
Ler env.apiBaseUrl
Adicionar Authorization Bearer automaticamente
Permitir chamadas sem auth usando auth: false
Tratar 401 limpando sessão e redirecionando para /login
Tratar 403 com mensagem amigável
Tratar erros nos formatos message/title/detail/errors
Retornar undefined em 204
Fazer parse JSON em respostas normais
```

O frontend usa esse client para todas as chamadas à API.

---

## 15. Frontend — autenticação implementada

Foram criados:

```txt
src/features/auth/types/authTypes.ts
src/features/auth/api/authApi.ts
src/features/auth/lib/authStorage.ts
src/features/auth/providers/AuthProvider.tsx
```

### AuthProvider

Gerencia:

```txt
user
isAuthenticated
isLoading
signIn
signOut
refreshCurrentUser
```

Ao iniciar a aplicação:

```txt
1. Verifica token salvo.
2. Verifica expiresAt.
3. Se válido, chama GET /api/Auth/me.
4. Se inválido, limpa sessão.
```

### LoginPage

Arquivo:

```txt
src/features/auth/pages/LoginPage.tsx
```

Implementado com login real:

```http
POST /api/Auth/login
```

Credenciais usadas em desenvolvimento:

```txt
admin@sicou.com
Admin123
```

Após login:

```txt
token salvo no localStorage
expiresAt salvo
user salvo
redireciona para /app/dashboard
```

---

## 16. Frontend — roteamento implementado

Arquivos:

```txt
src/app/router/AppRouter.tsx
src/app/router/ProtectedRoute.tsx
```

Rotas atuais:

```txt
/
    redireciona para /app/dashboard

/login
    tela de login

/app
    layout administrativo protegido

/app/dashboard
    dashboard

/app/companies
    listagem e CRUD parcial de empresas

/app/companies/:companyId
    detalhes da empresa com unidades

/app/users
    placeholder

/app/access-control
    placeholder

*
    redireciona para /app/dashboard
```

`ProtectedRoute` valida:

```txt
isLoading
isAuthenticated
```

Usuário não autenticado é redirecionado para:

```txt
/login
```

---

## 17. Frontend — layout administrativo

Arquivo:

```txt
src/app/layouts/AdminLayout.tsx
```

Possui:

```txt
Sidebar
Header
Nome do usuário
Roles do usuário
Botão sair
Menu por role
Área de conteúdo com Outlet
Responsividade básica para mobile
```

Menus atuais:

```txt
Dashboard
Empresas
Usuários
Permissões
```

Visibilidade por role:

```txt
Dashboard:
SUPER_ADMIN, COMPANY_ADMIN, AREA_ADMIN, HEADQUARTER_USER, UNIT_USER

Empresas:
SUPER_ADMIN

Usuários:
SUPER_ADMIN, COMPANY_ADMIN

Permissões:
SUPER_ADMIN, COMPANY_ADMIN
```

---

## 18. Frontend — dashboard

Arquivo:

```txt
src/app/pages/DashboardPage.tsx
```

Mostra:

```txt
cards de Empresas, Usuários e Permissões
informações da sessão atual
nome, email e roles do usuário
```

---

## 19. Frontend — empresas implementadas

### Arquivos

```txt
src/features/companies/types/companyTypes.ts
src/features/companies/api/companiesApi.ts
src/features/companies/pages/CompaniesPage.tsx
src/features/companies/pages/CompanyDetailsPage.tsx
src/features/companies/components/CreateCompanyModal.tsx
src/features/companies/components/EditCompanyModal.tsx
src/features/companies/components/DeleteCompanyModal.tsx
```

### API implementada

```ts
getCompanies()
getCompanyById(id)
createCompany(request)
updateCompany(id, request)
deleteCompany(id)
```

### Funcionalidades implementadas

```txt
Listar empresas ativas
Criar empresa
Editar empresa
Inativar empresa
Abrir detalhes da empresa
Exibir status ativa/inativa
Atualizar lista
Exibir mensagens de erro vindas do backend
```

### Comportamento de inativação

Ao clicar em **Inativar**, o frontend chama:

```http
DELETE /api/companies/{id}
```

O backend faz soft delete:

```txt
IsActive = false
UpdatedAt = DateTime.UtcNow
```

Como a listagem `GET /api/companies` retorna apenas empresas ativas, a empresa some da tabela após ser inativada. Esse comportamento está correto e esperado.

### Rota de detalhes

```txt
/app/companies/:companyId
```

A página busca:

```http
GET /api/companies/{id}
```

E mostra:

```txt
Nome
Documento
Criada em
Atualizada em
Status
Bloco de Unidades
Placeholder de Áreas
```

---

## 20. Frontend — unidades implementadas parcialmente

### Arquivos

```txt
src/features/units/types/unitTypes.ts
src/features/units/api/unitsApi.ts
src/features/units/components/CompanyUnitsSection.tsx
src/features/units/components/CreateUnitModal.tsx
```

### API implementada

```ts
getUnitsByCompanyId(companyId)
createUnit(companyId, request)
```

### Funcionalidades implementadas

Dentro da página de detalhes da empresa:

```txt
Listar unidades da empresa
Atualizar lista de unidades
Criar nova unidade
Exibir tabela de unidades
Exibir vazio quando não houver unidades
Exibir mensagens de erro vindas do backend
```

### Endpoint usado para listar unidades

```http
GET /api/companies/{companyId}/units
```

### Endpoint usado para criar unidade

```http
POST /api/companies/{companyId}/units
```

### Campos do modal de nova unidade

```txt
Nome da unidade
Código
Cidade
Estado
```

`Estado` é convertido para maiúsculo no input.

---

## 21. Estado exato onde paramos hoje

A última etapa concluída foi:

```txt
Passo Front 14 — Criar unidade dentro da empresa
```

Foi validado que:

```txt
O botão "Nova unidade" abre modal
O formulário cria unidade no backend
O modal fecha ao salvar
A listagem de unidades atualiza
A nova unidade aparece na tabela
```

A próxima etapa planejada é:

```txt
Passo Front 15 — Editar e inativar unidade
```

Essa etapa deve implementar:

```http
PUT    /api/units/{id}
DELETE /api/units/{id}
```

E adicionar ações na tabela de unidades:

```txt
Editar
Inativar
```

---

## 22. Próximo passo recomendado amanhã

Começar por:

```txt
Passo Front 15 — Editar e inativar unidade
```

### Objetivo

Adicionar à tabela de unidades:

```txt
Editar
Inativar
```

### Arquivos que provavelmente serão alterados/criados

```txt
src/features/units/api/unitsApi.ts
src/features/units/components/EditUnitModal.tsx
src/features/units/components/DeleteUnitModal.tsx
src/features/units/components/CompanyUnitsSection.tsx
src/features/units/components/index.ts
```

### Funções esperadas na API

```ts
export async function updateUnit(id: string, request: UpdateUnitRequest) {
  return apiFetch<Unit>(`/api/units/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deleteUnit(id: string) {
  return apiFetch<void>(`/api/units/${id}`, {
    method: 'DELETE',
  });
}
```

### Comportamento esperado

```txt
Editar unidade:
- abrir modal preenchido
- alterar nome/código/cidade/estado/status
- salvar via PUT /api/units/{id}
- recarregar listagem

Inativar unidade:
- abrir modal de confirmação
- chamar DELETE /api/units/{id}
- recarregar listagem
- unidade deve sumir da listagem, porque backend lista apenas ativas
```

---

## 23. Próximas etapas depois de unidades

Depois de concluir edição/inativação de unidades, seguir:

```txt
Passo Front 16 — Listar áreas da empresa em CompanyDetailsPage
Passo Front 17 — Criar área com módulos
Passo Front 18 — Editar e inativar área
Passo Front 19 — Atualizar módulos da área
Passo Front 20 — Gestão de usuários
Passo Front 21 — Gestão de acessos granulares
```

Somente depois disso iniciar telas reais de:

```txt
Informativos
Orientador
Workflows
```

porque os módulos finais ainda não existem no backend.

---

## 24. Cuidados técnicos atuais

### 24.1 Soft delete

Usar sempre termos como:

```txt
Inativar
Desativar
```

Evitar:

```txt
Excluir definitivamente
Apagar
Remover permanente
```

### 24.2 Listagens padrão

As listagens atuais retornam apenas registros ativos:

```txt
GET /api/companies
GET /api/companies/{companyId}/units
GET /api/companies/{companyId}/areas
```

Então, depois de inativar, o item some da tela.

### 24.3 Reativação

Ainda não foi criada interface de reativação.

Pode ser implementada futuramente com:

```txt
filtro "exibir inativos"
tela de registros inativos
botão "reativar"
```

Mas isso não é prioridade agora.

### 24.4 Permissões efetivas

Ainda não existe:

```http
GET /api/Auth/me/permissions
```

Por enquanto o frontend usa:

```txt
roles do usuário
/api/Auth/me
```

Isso é suficiente para o núcleo administrativo com SUPER_ADMIN.

### 24.5 Paginação

Ainda não há paginação no backend ou frontend.

Listagens atuais carregam tudo.

Futuramente, adicionar paginação principalmente em:

```txt
companies
users
access-control
```

### 24.6 COMPANY_ADMIN

O backend ainda precisa refinar o escopo de `COMPANY_ADMIN` para impedir acesso entre empresas.

Por enquanto o desenvolvimento e testes estão focados no `SUPER_ADMIN`.

### 24.7 Controllers temporários

Antes de produção, revisar/remover/proteger:

```txt
AdminSetupController
AreaPolicyTestController
SecurityTestController
```

---

## 25. Como rodar amanhã

### Backend

Abrir a solução backend e rodar a API em:

```txt
http://localhost:5175
```

Validar Swagger:

```txt
http://localhost:5175/swagger
```

### Frontend

Entrar na pasta:

```txt
C:\Users\kinha\sicou\frontend\sicou-front
```

Rodar:

```bash
npm run dev
```

Acessar:

```txt
http://localhost:5173
```

Login de desenvolvimento:

```txt
admin@sicou.com
Admin123
```

---

## 26. Resumo curto para iniciar o próximo chat

Copie e cole este texto em um novo chat, se necessário:

```txt
Estou desenvolvendo o projeto Sicou.

Backend:
- .NET 8, ASP.NET Core Web API, EF Core, Identity, JWT, PostgreSQL e Swagger.
- Arquitetura em camadas: Api, Application, Domain, Infrastructure.
- Repository Pattern e Service Layer aplicados.
- Roles: SUPER_ADMIN, COMPANY_ADMIN, AREA_ADMIN, HEADQUARTER_USER, UNIT_USER.
- Policies: CanManageCompany, CanManageArea, CanViewArea, CanPublishInformative, CanManageGuide, CanManageWorkflow, CanHandleWorkflow.
- CRUD de Company, Unit, Area, Users e UserAreaAccess já existem.
- Módulos iniciais: Informatives, Guide, Workflows.
- CORS já foi configurado para http://localhost:5173.
- Middleware global básico de exceções foi criado.
- Listagens de companies, units e areas agora retornam apenas ativos.
- AreaService retorna apenas módulos ativos e habilitados.
- UserAreaAccessService valida usuário existente/ativo e reativa acesso inativo se recriado.
- Não implementamos ainda GET /api/Auth/me/permissions.

Frontend:
- Criado com Vite + React + TypeScript + Tailwind.
- Local: C:\Users\kinha\sicou\frontend\sicou-front.
- API base em .env.development: VITE_API_BASE_URL=http://localhost:5175.
- Dependências: react-router, lucide-react, clsx, tailwind-merge, tailwindcss, @tailwindcss/vite.
- Estrutura por app/shared/features/modules.
- apiFetch centralizado em src/shared/api/apiFetch.ts.
- AuthProvider implementado com login, logout, sessão persistida e /api/Auth/me.
- Rotas protegidas implementadas.
- AdminLayout com sidebar/header implementado.
- Login real funcionando.
- Dashboard implementado.
- Empresas: listar, criar, editar, inativar e abrir detalhes funcionando.
- Rota /app/companies/:companyId funcionando.
- Na página de detalhes da empresa, unidades já são listadas e já é possível criar unidade.
- Última etapa concluída: Passo Front 14 — criar unidade dentro da empresa.
- Próxima etapa: Passo Front 15 — editar e inativar unidade usando PUT /api/units/{id} e DELETE /api/units/{id}.
Quero continuar exatamente desse ponto, seguindo um passo por vez.
```

---

## 27. Decisão atual

O projeto está no caminho correto.

O backend recebeu apenas os ajustes necessários para o frontend consumir melhor a API. O frontend já começou integrado de verdade, com autenticação, layout, CRUD de empresas e início do gerenciamento de unidades.

Amanhã, a continuação mais indicada é:

```txt
Passo Front 15 — Editar e inativar unidade
```

Depois disso, seguir para áreas da empresa.
