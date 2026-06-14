# Sicou Backend

Backend do **Sicou**, uma plataforma modular para organização, governança e centralização de processos entre uma sede administrativa e suas unidades.

O objetivo do sistema é permitir que uma empresa configure sua estrutura corporativa, cadastre unidades, organize áreas da sede, habilite módulos por área, gerencie usuários, delegue permissões granulares e, nas próximas fases, publique informativos, orientações e fluxos de trabalho para as unidades.

---

## Contexto rápido para continuar o desenvolvimento

Este README foi atualizado após a implementação da base administrativa consumida pelo frontend. O backend atual já suporta autenticação, cadastros centrais, gestão de usuários e controle granular por área.

Stack principal:

```txt
.NET 8
ASP.NET Core Web API
Entity Framework Core
PostgreSQL
ASP.NET Core Identity
JWT Bearer
Swagger / OpenAPI
Arquitetura em camadas
Repository Pattern
Service Layer
DTOs de Request/Response
Authorization Policies
```

Estado atual:

```txt
Base de autenticação e autorização: concluída
CRUD de empresas: concluído
CRUD de unidades: concluído
CRUD de áreas com módulos: concluído
CRUD administrativo de usuários: concluído
CRUD de acessos granulares por área: concluído no backend
Policies granulares por área: concluídas
Frontend administrativo consumindo empresas, unidades, áreas e usuários: em andamento/concluído nessas features
Próxima etapa recomendada: tela de controle de acessos granulares no frontend e refinamento de autorização por escopo no backend
```

Resumo do que já funciona:

```txt
Autenticação com login, registro e usuário atual
JWT com roles no token
Swagger com autenticação Bearer
Seed das roles do sistema
Seed dos módulos centrais
Promoção manual de SUPER_ADMIN em desenvolvimento
CRUD de Company
CRUD de Unit
CRUD de Area
Atualização de módulos habilitados por Area
CRUD administrativo de usuários
Atualização de roles de usuários
Soft delete em empresas, unidades, áreas, usuários e acessos
CRUD de UserAreaAccess
Policies granulares baseadas no parâmetro areaId da rota
Middleware global de tratamento de exceções
CORS configurado para o frontend local
```

---

## Visão geral do produto

O Sicou foi pensado como uma plataforma de governança operacional para empresas com estrutura de sede e unidades.

Estrutura conceitual:

```txt
Empresa
├── Unidades
└── Áreas da sede
    ├── Informativos
    ├── Orientador
    └── Workflows
```

Cada empresa pode possuir várias unidades e várias áreas da sede. Cada área pode habilitar um ou mais módulos.

Exemplo:

```txt
Área Jurídica
├── Informativos
├── Orientador
└── Workflows

Área Marketing
├── Informativos
└── Orientador

Área Financeira
└── Workflows
```

O papel do backend nesta etapa é fornecer a base organizacional e de segurança para que os módulos futuros possam ser criados respeitando empresa, unidade, área e permissões do usuário autenticado.

---

## Estrutura atual da solução

```txt
backend/
├── Sicou.sln
├── Dockerfile
├── README.md
├── src/
│   ├── Api/
│   │   ├── Controllers/
│   │   │   ├── AdminSetupController.cs
│   │   │   ├── AreaPolicyTestController.cs
│   │   │   ├── AreasController.cs
│   │   │   ├── AuthController.cs
│   │   │   ├── CompaniesController.cs
│   │   │   ├── SecurityTestController.cs
│   │   │   ├── UnitsController.cs
│   │   │   ├── UserAreaAccessesController.cs
│   │   │   └── UsersController.cs
│   │   ├── Middlewares/
│   │   │   └── ExceptionHandlingMiddleware.cs
│   │   ├── Responses/
│   │   │   └── ApiErrorResponse.cs
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   ├── appsettings.Development.json
│   │   └── Sicou.Api.csproj
│   │
│   ├── Application/
│   │   ├── Interfaces/
│   │   │   ├── Auth/
│   │   │   ├── Repositories/
│   │   │   └── Services/
│   │   ├── Requests/
│   │   │   ├── Areas/
│   │   │   ├── Auth/
│   │   │   ├── Companies/
│   │   │   ├── Units/
│   │   │   ├── UserAreaAccesses/
│   │   │   └── Users/
│   │   ├── Responses/
│   │   │   ├── Areas/
│   │   │   ├── Auth/
│   │   │   ├── Companies/
│   │   │   ├── Units/
│   │   │   ├── UserAreaAccesses/
│   │   │   └── Users/
│   │   └── Sicou.Application.csproj
│   │
│   ├── Domain/
│   │   ├── Common/
│   │   │   └── BaseEntity.cs
│   │   ├── Constants/
│   │   │   ├── SystemPolicies.cs
│   │   │   └── SystemRoles.cs
│   │   ├── Entities/
│   │   │   ├── Area.cs
│   │   │   ├── AreaModule.cs
│   │   │   ├── Company.cs
│   │   │   ├── Module.cs
│   │   │   ├── Unit.cs
│   │   │   └── UserAreaAccess.cs
│   │   ├── Enums/
│   │   │   └── ModuleCode.cs
│   │   └── Sicou.Domain.csproj
│   │
│   └── Infrastructure/
│       ├── Authorization/
│       │   ├── AreaPermissionHandler.cs
│       │   └── AreaPermissionRequirement.cs
│       ├── Configurations/
│       │   └── CorsConfiguration.cs
│       ├── Data/
│       │   ├── ApplicationDbContext.cs
│       │   └── Migrations/
│       ├── Extensions/
│       │   └── DependencyInjection.cs
│       ├── Identity/
│       │   ├── ApplicationRole.cs
│       │   └── ApplicationUser.cs
│       ├── Repositories/
│       ├── Seed/
│       │   └── IdentitySeeder.cs
│       ├── Services/
│       └── Sicou.Infrastructure.csproj
│
└── tests/
    ├── Sicou.IntegrationTests/
    └── Sicou.UnitTests/
```

---

## Arquitetura aplicada

A estrutura segue separação por camadas:

### `Api`

Responsável pela entrada HTTP da aplicação.

Contém:

```txt
Controllers
Middlewares
Program.cs
Configuração de Swagger
Configuração de autenticação JWT
Registro das policies de autorização
```

Os controllers devem ser mantidos finos. Eles recebem requests, chamam services e retornam responses HTTP.

### `Application`

Camada de contratos e DTOs.

Contém:

```txt
Interfaces de services
Interfaces de repositories
Interfaces de autenticação/contexto atual
Requests
Responses
```

Essa camada não deve depender de EF Core, Identity ou ASP.NET diretamente.

### `Domain`

Camada de domínio do sistema.

Contém:

```txt
Entidades centrais
Enums
Constantes de roles
Constantes de policies
BaseEntity
```

### `Infrastructure`

Camada de implementação técnica.

Contém:

```txt
DbContext
Migrations
Identity
Repositories
Services
Authorization Handlers
Seed de roles
Configurações de CORS
Injeção de dependência
```

---

## Padrões utilizados

### Repository Pattern

Acesso ao banco fica centralizado nos repositories.

Exemplos:

```txt
CompanyRepository
UnitRepository
AreaRepository
UserAreaAccessRepository
```

Contratos correspondentes ficam em:

```txt
src/Application/Interfaces/Repositories
```

### Service Layer

Regras de negócio ficam nos services.

Exemplos:

```txt
CompanyService
UnitService
AreaService
UserService
UserAreaAccessService
PermissionService
AuthService
JwtTokenService
```

Contratos correspondentes ficam em:

```txt
src/Application/Interfaces/Services
src/Application/Interfaces/Auth
```

### DTOs de Request/Response

A API não expõe diretamente as entidades do EF Core. Os payloads são representados por classes em:

```txt
src/Application/Requests
src/Application/Responses
```

### Soft delete

As entidades principais herdam de `BaseEntity` e possuem:

```txt
Id
CreatedAt
UpdatedAt
IsActive
```

Deletes administrativos atualmente marcam registros como inativos em vez de remover fisicamente.

---

## Como rodar localmente

### Pré-requisitos

```txt
.NET SDK 8
PostgreSQL
EF Core CLI opcional
```

Instalação da CLI do EF, caso necessário:

```bash
dotnet tool install --global dotnet-ef
```

### Banco de dados

Configuração atual em `src/Api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=sicou-dev;Username=postgres;Password=rootroot"
  }
}
```

Ajuste usuário, senha, host e banco conforme seu ambiente local.

### Aplicar migrations

A partir da raiz do backend:

```bash
dotnet ef database update --project src/Infrastructure --startup-project src/Api
```

### Rodar API

```bash
dotnet run --project src/Api
```

URLs locais configuradas no `launchSettings.json`:

```txt
HTTP:  http://localhost:5175
HTTPS: https://localhost:7299
Swagger: http://localhost:5175/swagger
```

### CORS

O frontend local permitido por padrão é:

```txt
http://localhost:5173
```

Isso está configurado em:

```txt
src/Infrastructure/Configurations/CorsConfiguration.cs
```

---

## Seed inicial

### Roles

Ao iniciar a aplicação, `IdentitySeeder.SeedRolesAsync(app.Services)` cria as roles do sistema:

```txt
SUPER_ADMIN
COMPANY_ADMIN
AREA_ADMIN
HEADQUARTER_USER
UNIT_USER
```

### Módulos

O `ApplicationDbContext` faz seed dos módulos centrais:

```txt
Informatives = 1
Guide        = 2
Workflows   = 3
```

Payloads JSON usam enum como string porque o `Program.cs` registra `JsonStringEnumConverter`.

Exemplo:

```json
{
  "moduleCodes": ["Informatives", "Guide", "Workflows"]
}
```

---

## Autenticação

A autenticação usa ASP.NET Core Identity com JWT Bearer.

Endpoints:

```txt
POST /api/Auth/register
POST /api/Auth/login
GET  /api/Auth/me
```

### Login

Request:

```json
{
  "email": "admin@sicou.com",
  "password": "Admin123"
}
```

Response:

```json
{
  "accessToken": "jwt-token",
  "expiresAt": "2026-06-14T12:00:00Z",
  "user": {
    "id": "guid",
    "fullName": "Administrador",
    "email": "admin@sicou.com",
    "isActive": true,
    "companyId": null,
    "unitId": null,
    "roles": ["SUPER_ADMIN"]
  }
}
```

O JWT contém claims de:

```txt
sub
email
ClaimTypes.NameIdentifier
ClaimTypes.Name
ClaimTypes.Email
ClaimTypes.Role
```

### Promoção de usuário para SUPER_ADMIN

Controller temporário de setup:

```txt
POST /api/admin-setup/promote-super-admin?email=admin@sicou.com
```

Atenção: esse endpoint está aberto e deve ser removido, protegido ou condicionado ao ambiente de desenvolvimento antes de qualquer ambiente público.

---

## Autorização

### Roles do sistema

```txt
SUPER_ADMIN
COMPANY_ADMIN
AREA_ADMIN
HEADQUARTER_USER
UNIT_USER
```

Uso atual:

```txt
CompaniesController: SUPER_ADMIN
UnitsController: SUPER_ADMIN
AreasController: SUPER_ADMIN
UsersController: SUPER_ADMIN, COMPANY_ADMIN
UserAreaAccessesController: SUPER_ADMIN, COMPANY_ADMIN
SecurityTestController: testes
```

### Policies granulares

Constantes em `SystemPolicies`:

```txt
CanManageCompany
CanViewArea
CanManageArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

Atualmente registradas no `Program.cs`:

```txt
CanViewArea
CanManageArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

`CanManageCompany` existe como constante e existe regra em `PermissionService.CanManageCompanyAsync`, mas ainda não foi registrada nem aplicada nos controllers. Este é um ponto importante para a próxima etapa de refinamento de segurança.

### Como as policies de área funcionam

As policies usam `AreaPermissionHandler` e dependem de uma rota com parâmetro:

```txt
{areaId}
```

Exemplo de rota protegida:

```csharp
[HttpGet("api/areas/{areaId:guid}/algum-recurso")]
[Authorize(Policy = SystemPolicies.CanViewArea)]
public IActionResult Get(Guid areaId)
{
    return Ok();
}
```

Se o parâmetro não se chamar exatamente `areaId`, o handler não consegue resolver a área.

### Comportamento de permissão

`SUPER_ADMIN`:

```txt
Tem acesso total às permissões granulares por área.
```

`COMPANY_ADMIN`:

```txt
Tem permissão de área se o usuário estiver vinculado à mesma empresa da área.
```

Demais usuários:

```txt
Precisam de registro ativo em user_area_accesses para a área específica.
```

---

## Entidades principais

### Company

Representa uma empresa cliente ou organização principal.

Campos principais:

```txt
Id
Name
Document
IsActive
CreatedAt
UpdatedAt
Units
Areas
```

### Unit

Representa uma unidade/filial vinculada a uma empresa.

Campos principais:

```txt
Id
CompanyId
Name
Code
City
State
IsActive
CreatedAt
UpdatedAt
```

### Area

Representa uma área da sede dentro de uma empresa.

Campos principais:

```txt
Id
CompanyId
Name
Slug
Description
IsActive
CreatedAt
UpdatedAt
AreaModules
```

### Module

Representa um módulo funcional habilitável por área.

Módulos atuais:

```txt
Informatives
Guide
Workflows
```

### AreaModule

Relaciona uma área a um módulo habilitado.

Campos principais:

```txt
AreaId
ModuleId
Enabled
IsActive
```

### ApplicationUser

Usuário Identity customizado.

Campos adicionais:

```txt
FullName
IsActive
CreatedAt
UpdatedAt
CompanyId
UnitId
```

### ApplicationRole

Role Identity customizada.

Campos adicionais:

```txt
Description
IsSystemRole
CreatedAt
```

### UserAreaAccess

Permissões granulares de um usuário dentro de uma área.

Campos principais:

```txt
UserId
CompanyId
UnitId
AreaId
CanView
CanManage
CanPublishInformatives
CanManageGuide
CanManageWorkflows
CanHandleWorkflowRequests
IsActive
CreatedAt
UpdatedAt
```

---

## Endpoints atuais

### Auth

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/Auth/register` | Anônimo | Cria usuário via fluxo público/dev |
| POST | `/api/Auth/login` | Anônimo | Autentica e retorna JWT |
| GET | `/api/Auth/me` | JWT | Retorna usuário autenticado |

---

### Companies

Protegido por:

```txt
SUPER_ADMIN
```

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/companies` | Cria empresa |
| GET | `/api/companies` | Lista empresas |
| GET | `/api/companies/{id}` | Busca empresa por ID |
| PUT | `/api/companies/{id}` | Atualiza empresa |
| DELETE | `/api/companies/{id}` | Inativa empresa |

Create:

```json
{
  "name": "Empresa Exemplo",
  "document": "00.000.000/0001-00"
}
```

Update:

```json
{
  "name": "Empresa Exemplo Atualizada",
  "document": "00.000.000/0001-00",
  "isActive": true
}
```

Response:

```json
{
  "id": "guid",
  "name": "Empresa Exemplo",
  "document": "00.000.000/0001-00",
  "isActive": true,
  "createdAt": "2026-06-14T12:00:00Z",
  "updatedAt": null
}
```

Regras principais:

```txt
Nome obrigatório
Nome único
Delete é soft delete
```

---

### Units

Protegido por:

```txt
SUPER_ADMIN
```

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/companies/{companyId}/units` | Cria unidade em uma empresa |
| GET | `/api/companies/{companyId}/units` | Lista unidades da empresa |
| GET | `/api/units/{id}` | Busca unidade por ID |
| PUT | `/api/units/{id}` | Atualiza unidade |
| DELETE | `/api/units/{id}` | Inativa unidade |

Create:

```json
{
  "name": "Unidade Centro",
  "code": "CENTRO",
  "city": "São Paulo",
  "state": "SP"
}
```

Update:

```json
{
  "name": "Unidade Centro",
  "code": "CENTRO",
  "city": "São Paulo",
  "state": "SP",
  "isActive": true
}
```

Response:

```json
{
  "id": "guid",
  "companyId": "guid",
  "companyName": "Empresa Exemplo",
  "name": "Unidade Centro",
  "code": "CENTRO",
  "city": "São Paulo",
  "state": "SP",
  "isActive": true,
  "createdAt": "2026-06-14T12:00:00Z",
  "updatedAt": null
}
```

Regras principais:

```txt
Empresa precisa existir
Empresa precisa estar ativa para criar unidade
Nome obrigatório
Nome único por empresa
Código único por empresa quando informado
State é normalizado para uppercase
Delete é soft delete
```

---

### Areas

Protegido por:

```txt
SUPER_ADMIN
```

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/companies/{companyId}/areas` | Cria área em uma empresa |
| GET | `/api/companies/{companyId}/areas` | Lista áreas da empresa |
| GET | `/api/areas/{id}` | Busca área por ID |
| PUT | `/api/areas/{id}` | Atualiza dados da área |
| PUT | `/api/areas/{id}/modules` | Atualiza módulos habilitados da área |
| DELETE | `/api/areas/{id}` | Inativa área e módulos vinculados |

Create:

```json
{
  "name": "Jurídico",
  "description": "Área jurídica da sede",
  "moduleCodes": ["Informatives", "Guide", "Workflows"]
}
```

Update:

```json
{
  "name": "Jurídico",
  "description": "Área jurídica da sede",
  "isActive": true
}
```

Update modules:

```json
{
  "moduleCodes": ["Informatives", "Guide"]
}
```

Response:

```json
{
  "id": "guid",
  "companyId": "guid",
  "companyName": "Empresa Exemplo",
  "name": "Jurídico",
  "slug": "juridico",
  "description": "Área jurídica da sede",
  "isActive": true,
  "createdAt": "2026-06-14T12:00:00Z",
  "updatedAt": null,
  "modules": [
    {
      "moduleId": "guid",
      "code": "Informatives",
      "name": "Informativos",
      "enabled": true
    }
  ]
}
```

Regras principais:

```txt
Empresa precisa existir
Empresa precisa estar ativa para criar área
Nome obrigatório
Slug gerado automaticamente a partir do nome
Slug único por empresa
Módulos informados precisam existir no seed
Delete é soft delete da área e desabilita/inativa AreaModules
```

Observação técnica já corrigida:

```txt
O update de módulos remove os vínculos antigos e adiciona novos com AddRange no repository.
Isso evita DbUpdateConcurrencyException causada por EF tentando atualizar novos AreaModules como se já existissem.
```

---

### Users

Protegido por:

```txt
SUPER_ADMIN, COMPANY_ADMIN
```

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/users` | Cria usuário administrativo |
| GET | `/api/users` | Lista usuários |
| GET | `/api/users/{id}` | Busca usuário por ID |
| PUT | `/api/users/{id}` | Atualiza dados, vínculo e status |
| PUT | `/api/users/{id}/roles` | Atualiza roles do usuário |
| DELETE | `/api/users/{id}` | Inativa usuário |

Create:

```json
{
  "fullName": "João Silva",
  "email": "joao@sicou.com",
  "password": "Admin123",
  "companyId": "guid-ou-null",
  "unitId": "guid-ou-null",
  "roles": ["COMPANY_ADMIN"]
}
```

Update atual:

```json
{
  "fullName": "João Silva",
  "companyId": "guid-ou-null",
  "unitId": "guid-ou-null",
  "isActive": true
}
```

Update roles:

```json
{
  "roles": ["COMPANY_ADMIN", "AREA_ADMIN"]
}
```

Response:

```json
{
  "id": "guid",
  "fullName": "João Silva",
  "email": "joao@sicou.com",
  "isActive": true,
  "companyId": "guid-ou-null",
  "unitId": "guid-ou-null",
  "roles": ["COMPANY_ADMIN"],
  "createdAt": "2026-06-14T12:00:00Z",
  "updatedAt": null
}
```

Regras principais:

```txt
E-mail único na criação
CompanyId opcional, mas se informado precisa existir
UnitId opcional, mas se informado precisa existir
Se UnitId e CompanyId forem informados, unidade precisa pertencer à empresa
Roles precisam existir no Identity
Delete é soft delete usando IsActive = false
Login bloqueia usuário inativo
```

Atenção importante:

```txt
UpdateUserRequest atualmente não possui campo Email.
O frontend pode enviar email no PUT /api/users/{id}, mas o backend ignora esse campo porque ele não está no DTO.
Se a edição de e-mail for desejada, adicionar Email em UpdateUserRequest e ajustar UserService.UpdateAsync para atualizar Email e UserName via UserManager.
```

---

### UserAreaAccesses

Protegido por:

```txt
SUPER_ADMIN, COMPANY_ADMIN
```

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/user-area-accesses` | Cria vínculo/permissões de usuário em área |
| GET | `/api/user-area-accesses/{id}` | Busca acesso por ID |
| GET | `/api/user-area-accesses/by-user/{userId}` | Lista acessos de um usuário |
| GET | `/api/user-area-accesses/by-company/{companyId}` | Lista acessos de uma empresa |
| PUT | `/api/user-area-accesses/{id}` | Atualiza permissões |
| DELETE | `/api/user-area-accesses/{id}` | Inativa acesso |

Create:

```json
{
  "userId": "guid-do-usuario",
  "companyId": "guid-da-empresa",
  "unitId": null,
  "areaId": "guid-da-area",
  "canView": true,
  "canManage": false,
  "canPublishInformatives": true,
  "canManageGuide": false,
  "canManageWorkflows": false,
  "canHandleWorkflowRequests": false
}
```

Update:

```json
{
  "canView": true,
  "canManage": true,
  "canPublishInformatives": true,
  "canManageGuide": true,
  "canManageWorkflows": false,
  "canHandleWorkflowRequests": false
}
```

Response:

```json
{
  "id": "guid",
  "userId": "guid-do-usuario",
  "companyId": "guid-da-empresa",
  "companyName": "Empresa Exemplo",
  "unitId": null,
  "unitName": null,
  "areaId": "guid-da-area",
  "areaName": "Jurídico",
  "canView": true,
  "canManage": true,
  "canPublishInformatives": true,
  "canManageGuide": true,
  "canManageWorkflows": false,
  "canHandleWorkflowRequests": false,
  "isActive": true,
  "createdAt": "2026-06-14T12:00:00Z",
  "updatedAt": null
}
```

Regras principais:

```txt
UserId obrigatório
Usuário precisa existir e estar ativo
Empresa precisa existir e estar ativa
Área precisa existir e estar ativa
Área precisa pertencer à empresa informada
Unidade é opcional
Se unidade for informada, precisa estar ativa e pertencer à empresa
Não permite duplicidade ativa para UserId + CompanyId + UnitId + AreaId
Se existir registro inativo com a mesma chave, ele é reativado e atualizado
Delete é soft delete
```

---

### Testes e setup temporário

Endpoints úteis em desenvolvimento:

```txt
POST /api/admin-setup/promote-super-admin?email={email}
GET  /api/security-test/authenticated
GET  /api/security-test/super-admin
```

Endpoints de teste de policies por área:

```txt
GET /api/area-policy-test/{areaId}/can-view
GET /api/area-policy-test/{areaId}/can-manage
GET /api/area-policy-test/{areaId}/can-publish-informative
GET /api/area-policy-test/{areaId}/can-manage-guide
GET /api/area-policy-test/{areaId}/can-manage-workflow
GET /api/area-policy-test/{areaId}/can-handle-workflow
```

Esses controllers são úteis durante o desenvolvimento, mas devem ser removidos ou protegidos antes de produção.

---

## Integração atual com o frontend

O frontend React + Tailwind já consome os endpoints centrais deste backend.

Features já integradas no frontend:

```txt
Auth com JWT
GET /api/Auth/me
Companies CRUD
Units CRUD
Areas CRUD com módulos
Users CRUD administrativo
```

Próxima integração frontend/backend:

```txt
Controle de acessos granulares por área usando /api/user-area-accesses
```

A tela recomendada deve permitir:

```txt
Selecionar empresa
Selecionar usuário
Selecionar área
Selecionar unidade opcional
Marcar permissões:
  - Visualizar
  - Gerenciar área
  - Publicar informativos
  - Gerenciar orientador
  - Gerenciar workflows
  - Tratar solicitações de workflow
Criar vínculo
Editar vínculo
Inativar vínculo
Listar acessos por empresa
Listar acessos por usuário
```

---

## Próximos passos recomendados

### 1. Implementar tela de acessos granulares no frontend

Usar endpoints:

```txt
GET  /api/user-area-accesses/by-company/{companyId}
GET  /api/user-area-accesses/by-user/{userId}
POST /api/user-area-accesses
PUT  /api/user-area-accesses/{id}
DELETE /api/user-area-accesses/{id}
```

Essa etapa fecha a governança administrativa antes dos módulos de negócio.

### 2. Refinar autorização por escopo no backend

Atualmente alguns controllers aceitam `COMPANY_ADMIN`, mas ainda não restringem tudo ao `CompanyId` do usuário autenticado.

Melhorias recomendadas:

```txt
Registrar e aplicar CanManageCompany
Usar ICurrentUserService nos services/controllers administrativos
Garantir que COMPANY_ADMIN só veja/gerencie dados da própria empresa
Evitar que COMPANY_ADMIN crie/edite usuários fora da empresa dele
Evitar que COMPANY_ADMIN gerencie acessos de outra empresa
```

### 3. Ajustar edição de e-mail de usuário

Ponto atual:

```txt
UpdateUserRequest não possui Email.
UserService.UpdateAsync não altera Email/UserName.
```

Se o produto permitir edição de e-mail, implementar:

```txt
Adicionar Email em UpdateUserRequest
Validar e-mail único
Atualizar user.Email
Atualizar user.UserName
Atualizar NormalizedEmail/NormalizedUserName via UserManager quando necessário
Executar UserManager.UpdateAsync
```

### 4. Padronizar erros de service

Alguns services usam `Exception` genérica, principalmente em `UserService`.

Recomendado:

```txt
Trocar Exception por InvalidOperationException, KeyNotFoundException ou exceções de domínio próprias
Garantir respostas 400/404 em vez de 500 para erros de regra de negócio
Padronizar shape de erro em todos os controllers
Reduzir try/catch repetitivo nos controllers usando o middleware global
```

### 5. Remover ou proteger endpoints temporários

Antes de produção:

```txt
Remover ou proteger AdminSetupController
Remover ou proteger SecurityTestController
Remover ou proteger AreaPolicyTestController
```

### 6. Criar módulos de negócio

Após finalizar acessos granulares, iniciar os módulos por área.

Ordem recomendada:

```txt
Módulo Informativos
Módulo Orientador
Módulo Workflows
```

#### Módulo Informativos

Objetivo:

```txt
Permitir que áreas publiquem comunicados, novidades, arquivos e informações para unidades.
```

Policy sugerida:

```txt
CanPublishInformative para criar/editar/publicar
CanViewArea para visualizar
```

Entidades futuras possíveis:

```txt
Informative
InformativeAttachment
InformativeTargetUnit
InformativeReadReceipt
```

#### Módulo Orientador

Objetivo:

```txt
Permitir que áreas criem botões, links, arquivos e orientações rápidas.
```

Policy sugerida:

```txt
CanManageGuide para criar/editar
CanViewArea para visualizar
```

Entidades futuras possíveis:

```txt
GuideItem
GuideCategory
GuideAttachment
```

#### Módulo Workflows

Objetivo:

```txt
Permitir criação e execução de fluxos de atendimento/processos entre unidades e sede.
```

Policies sugeridas:

```txt
CanManageWorkflow para desenhar/configurar fluxos
CanHandleWorkflow para tratar solicitações
CanViewArea para acompanhar
```

Entidades futuras possíveis:

```txt
WorkflowDefinition
WorkflowStep
WorkflowRequest
WorkflowRequestHistory
WorkflowAttachment
```

### 7. Testes

Os projetos de teste existem, mas ainda estão com arquivos iniciais.

Recomendado criar testes para:

```txt
CompanyService
UnitService
AreaService
UserService
UserAreaAccessService
PermissionService
AuthService
Controllers principais
Policies por areaId
```

---

## Checklist técnico atual

Concluído:

```txt
Solução .NET 8 em camadas
Identity configurado
JWT configurado
Swagger com Bearer configurado
PostgreSQL com EF Core
Migrations criadas
Roles seedadas
Módulos seedados
CORS para frontend local
Middleware global de exceção
CRUD Companies
CRUD Units
CRUD Areas
CRUD Users
CRUD UserAreaAccesses
Policies de área
Frontend consumindo CRUDs centrais
```

Pendente/atenção:

```txt
Aplicar escopo real de COMPANY_ADMIN nos dados da empresa
Registrar/aplicar CanManageCompany
Decidir se edição de e-mail de usuário será permitida e ajustar backend
Proteger/remover controllers temporários
Padronizar exceptions de UserService
Criar testes reais
Implementar módulos Informativos, Orientador e Workflows
```

---

## Guia para retomar em novo chat

Para continuar deste ponto em outro chat, informe este resumo:

```txt
Estou desenvolvendo o Sicou.
Backend: C# .NET 8, ASP.NET Core Web API, EF Core, PostgreSQL, Identity e JWT.
Arquitetura: Api, Application, Domain, Infrastructure, MVC/controllers, Repository Pattern e Service Layer.
Já existem CRUDs completos no backend para Companies, Units, Areas, Users e UserAreaAccesses.
Áreas possuem módulos seedados: Informatives, Guide e Workflows.
Já existem roles: SUPER_ADMIN, COMPANY_ADMIN, AREA_ADMIN, HEADQUARTER_USER e UNIT_USER.
Já existem policies granulares por areaId: CanViewArea, CanManageArea, CanPublishInformative, CanManageGuide, CanManageWorkflow e CanHandleWorkflow.
O frontend React + Tailwind já consome Auth, Companies, Units, Areas e Users.
Próximo passo recomendado: implementar a tela de controle de acessos granulares no frontend usando /api/user-area-accesses e depois refinar o backend para aplicar escopo real de COMPANY_ADMIN.
```

---

## Observação sobre validação deste README

Este README foi reescrito com base na estrutura e no código atual do `backend.zip`. Neste ambiente de análise não foi possível executar `dotnet build` porque o SDK do .NET não está instalado, então a validação foi feita por inspeção do código e da estrutura do projeto.
