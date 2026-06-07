# Sicou Backend

Backend do **Sicou**, um sistema voltado para organização, governança e centralização de processos entre uma sede administrativa e suas unidades.

O objetivo do sistema é permitir que empresas com estrutura de **sede e unidades** possam configurar suas áreas internas, habilitar módulos por área, gerenciar usuários, delegar permissões granulares e, nas próximas etapas, disponibilizar informativos, orientações e fluxos de trabalho para as unidades.

---

## Contexto Rápido Para Continuação em Novo Chat

Este projeto está sendo desenvolvido com a stack:

```txt
Backend: .NET 8 + ASP.NET Core Web API
Banco: PostgreSQL
ORM: Entity Framework Core
Autenticação: ASP.NET Core Identity + JWT
Autorização: Roles + Policies granulares
Arquitetura: camadas Api, Application, Domain e Infrastructure
Padrões: Repository Pattern, Service Layer, DTOs para Requests/Responses
Frontend futuro: React + Tailwind
```

### Estado atual do backend

```txt
Etapa 1 a 9  — Base central do sistema: concluída
Etapa 10     — Governança granular de acessos: concluída
Etapa 11     — CRUD administrativo de usuários: concluída
Etapa 12     — Policies de autorização granular: concluída
Próxima etapa recomendada: Etapa 13 — Módulo de Informativos
```

### O que já funciona

```txt
Autenticação com Identity e JWT
Swagger com Bearer Token
Roles iniciais com seed
Usuário admin promovido para SUPER_ADMIN
CRUD de Company
CRUD de Unit
CRUD de Area com módulos habilitados
CRUD de UserAreaAccess
CRUD administrativo de Users
Atualização de roles de usuários
Policies granulares por AreaId
Endpoint de teste de policies por área
Soft delete em entidades principais
```

### Última etapa validada

A última etapa implementada e validada foi a **Etapa 12 — Policies de autorização granular**.

Foram criados:

```txt
SystemPolicies
ICurrentUserService
CurrentUserService
IPermissionService
PermissionService
AreaPermissionRequirement
AreaPermissionHandler
AreaPolicyTestController
```

Foram testadas com `SUPER_ADMIN` e retornaram `200 OK`:

```http
GET /api/area-policy-test/{areaId}/can-view
GET /api/area-policy-test/{areaId}/can-manage
GET /api/area-policy-test/{areaId}/can-publish-informative
GET /api/area-policy-test/{areaId}/can-manage-guide
GET /api/area-policy-test/{areaId}/can-manage-workflow
GET /api/area-policy-test/{areaId}/can-handle-workflow
```

---

## Visão Geral do Produto

O Sicou foi pensado como uma plataforma modular de governança operacional.

A estrutura principal do sistema segue o conceito:

```txt
Empresa
├── Unidades
└── Áreas da Sede
    ├── Informativos
    ├── Orientador
    └── Workflows
```

Cada empresa pode possuir várias unidades e várias áreas da sede. Cada área da sede pode ter módulos diferentes habilitados.

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

A ideia central é que a sede consiga organizar a comunicação, orientação e execução de processos junto às unidades.

---

## Stack Utilizada

- C#
- .NET 8
- ASP.NET Core Web API
- Entity Framework Core
- ASP.NET Core Identity
- JWT Bearer Authentication
- PostgreSQL
- Swagger / OpenAPI
- xUnit para testes
- Arquitetura em camadas
- Repository Pattern
- Service Layer
- Authorization Policies
- React + Tailwind planejados para o frontend

---

## Estrutura Atual da Solução

```txt
backend/
├── Sicou.sln
├── README.md
├── src/
│   ├── Api/
│   │   ├── Controllers/
│   │   │   ├── AdminSetupController.cs
│   │   │   ├── AreasController.cs
│   │   │   ├── AreaPolicyTestController.cs
│   │   │   ├── AuthController.cs
│   │   │   ├── CompaniesController.cs
│   │   │   ├── SecurityTestController.cs
│   │   │   ├── UnitsController.cs
│   │   │   ├── UserAreaAccessesController.cs
│   │   │   └── UsersController.cs
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   └── Sicou.Api.csproj
│   │
│   ├── Application/
│   │   ├── Interfaces/
│   │   │   ├── Auth/
│   │   │   │   ├── ICurrentUserService.cs
│   │   │   │   └── IJwtTokenService.cs
│   │   │   ├── Repositories/
│   │   │   │   ├── IAreaRepository.cs
│   │   │   │   ├── ICompanyRepository.cs
│   │   │   │   ├── IUnitRepository.cs
│   │   │   │   └── IUserAreaAccessRepository.cs
│   │   │   └── Services/
│   │   │       ├── IAreaService.cs
│   │   │       ├── ICompanyService.cs
│   │   │       ├── IPermissionService.cs
│   │   │       ├── IUnitService.cs
│   │   │       ├── IUserAreaAccessService.cs
│   │   │       └── IUserService.cs
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
│       ├── Data/
│       │   ├── ApplicationDbContext.cs
│       │   └── Migrations/
│       ├── Extensions/
│       │   └── DependencyInjection.cs
│       ├── Identity/
│       │   ├── ApplicationRole.cs
│       │   └── ApplicationUser.cs
│       ├── Repositories/
│       │   ├── AreaRepository.cs
│       │   ├── CompanyRepository.cs
│       │   ├── UnitRepository.cs
│       │   └── UserAreaAccessRepository.cs
│       ├── Seed/
│       │   └── IdentitySeeder.cs
│       ├── Services/
│       │   ├── AreaService.cs
│       │   ├── AuthService.cs
│       │   ├── CompanyService.cs
│       │   ├── CurrentUserService.cs
│       │   ├── JwtTokenService.cs
│       │   ├── PermissionService.cs
│       │   ├── UnitService.cs
│       │   ├── UserAreaAccessService.cs
│       │   └── UserService.cs
│       └── Sicou.Infrastructure.csproj
│
└── tests/
    ├── Sicou.UnitTests/
    └── Sicou.IntegrationTests/
```

---

## Arquitetura

O backend segue uma arquitetura em camadas com separação clara de responsabilidades.

```txt
Api
↓
Application
↓
Infrastructure
↓
Domain
```

A dependência conceitual é:

```txt
Api chama Application por interfaces e usa Infrastructure para registrar implementações.
Application define contratos, DTOs e abstrações.
Infrastructure implementa acesso a dados, Identity, JWT e services concretos.
Domain contém as entidades, enums, constantes e regras estruturais.
```

### Api

Camada de entrada da aplicação.

Responsável por:

- Controllers
- Rotas HTTP
- Swagger
- Configuração da aplicação
- Autenticação JWT
- Autorização por roles e policies
- Receber requests e retornar responses

A camada `Api` não deve conter regra de negócio pesada. Ela deve delegar para services.

### Application

Camada de contratos e modelos de aplicação.

Responsável por:

- Interfaces de serviços
- Interfaces de repositories
- Requests
- Responses
- DTOs de entrada e saída
- Contratos que a `Infrastructure` implementa

Essa camada não acessa diretamente o banco de dados.

### Domain

Camada de domínio.

Responsável por:

- Entidades principais
- Enums
- Constantes
- BaseEntity
- Regras estruturais do domínio

Essa camada não depende de nenhuma outra camada interna.

### Infrastructure

Camada de implementação técnica.

Responsável por:

- Entity Framework Core
- ApplicationDbContext
- ASP.NET Core Identity
- Repositories concretos
- Services concretos
- Seed de roles
- Geração de JWT
- Verificação de permissões
- Authorization handlers
- Integração com PostgreSQL

---

## Projetos da Solution

```txt
Sicou.Api
Sicou.Application
Sicou.Domain
Sicou.Infrastructure
Sicou.UnitTests
Sicou.IntegrationTests
```

---

## Dependências Entre Projetos

```txt
Sicou.Api
├── Sicou.Application
└── Sicou.Infrastructure

Sicou.Application
└── Sicou.Domain

Sicou.Infrastructure
├── Sicou.Application
└── Sicou.Domain

Sicou.Domain
└── sem dependências internas
```

---

## Padrões Aplicados

### Repository Pattern

O acesso ao banco de dados fica isolado em repositories.

Exemplo:

```txt
ICompanyRepository       -> CompanyRepository
IUnitRepository          -> UnitRepository
IAreaRepository          -> AreaRepository
IUserAreaAccessRepository -> UserAreaAccessRepository
```

Objetivo:

```txt
Separar consulta/persistência de dados das regras de negócio.
Facilitar testes.
Evitar DbContext espalhado pelos controllers.
```

### Service Layer

As regras de negócio ficam nos services.

Exemplo:

```txt
ICompanyService        -> CompanyService
IUnitService           -> UnitService
IAreaService           -> AreaService
IUserAreaAccessService -> UserAreaAccessService
IUserService           -> UserService
IPermissionService     -> PermissionService
```

Objetivo:

```txt
Concentrar validações e orquestrações.
Manter controllers simples.
Evitar regra de negócio na camada Api.
```

### DTOs de Request e Response

A API não recebe nem retorna diretamente as entidades do domínio.

São usadas classes em:

```txt
src/Application/Requests
src/Application/Responses
```

Objetivo:

```txt
Controlar o contrato da API.
Evitar exposição desnecessária de entidades.
Facilitar evolução dos endpoints.
```

### Soft Delete

Entidades principais usam remoção lógica:

```txt
IsActive = false
UpdatedAt = DateTime.UtcNow
```

Usado atualmente em:

```txt
Company
Unit
Area
UserAreaAccess
ApplicationUser
```

---

## Banco de Dados

Banco utilizado:

```txt
PostgreSQL
```

Banco local usado durante o desenvolvimento:

```txt
sicou_db
```

Exemplo de connection string:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=sicou_db;Username=postgres;Password=sua_senha"
  }
}
```

---

## Autenticação

O projeto utiliza:

- ASP.NET Core Identity
- JWT Bearer Token
- Roles do Identity
- Claims no token
- Swagger com Bearer Token

### ApplicationUser

Classe:

```txt
src/Infrastructure/Identity/ApplicationUser.cs
```

Campos customizados:

```txt
FullName
IsActive
CreatedAt
UpdatedAt
CompanyId
UnitId
```

Observações:

```txt
CompanyId pode ser nulo para SUPER_ADMIN.
UnitId pode ser nulo para usuários da sede.
Usuários de unidade normalmente possuem CompanyId e UnitId.
```

### ApplicationRole

Classe:

```txt
src/Infrastructure/Identity/ApplicationRole.cs
```

Campos customizados:

```txt
Description
IsSystemRole
CreatedAt
```

---

## Roles Iniciais

Arquivo:

```txt
src/Domain/Constants/SystemRoles.cs
```

Roles:

```txt
SUPER_ADMIN
COMPANY_ADMIN
AREA_ADMIN
HEADQUARTER_USER
UNIT_USER
```

Descrição:

```txt
SUPER_ADMIN
Administrador geral do sistema. Tem acesso global.

COMPANY_ADMIN
Administrador de uma empresa. Deve ficar restrito à própria empresa.

AREA_ADMIN
Administrador de uma área da sede. Deve depender de UserAreaAccess.

HEADQUARTER_USER
Usuário operacional da sede. Pode ter acessos por área.

UNIT_USER
Usuário operacional de uma unidade. Pode interagir com áreas da sede conforme permissões.
```

---

## Policies de Autorização

Arquivo:

```txt
src/Domain/Constants/SystemPolicies.cs
```

Policies criadas:

```txt
CanManageCompany
CanManageArea
CanViewArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

Atualmente estão registradas e validadas as policies por `areaId`:

```txt
CanViewArea
CanManageArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

A policy `CanManageCompany` foi definida como constante, mas ainda não foi implementada com handler próprio. Ela deve ser implementada em uma próxima etapa, pois depende de `companyId`, enquanto as policies já implementadas dependem de `areaId`.

### Como as policies por área funcionam

O handler lê o parâmetro da rota:

```txt
areaId
```

Por isso, rotas protegidas por essas policies devem usar esse nome explicitamente:

```http
GET /api/areas/{areaId}/alguma-coisa
POST /api/areas/{areaId}/informatives
POST /api/areas/{areaId}/guide-items
POST /api/areas/{areaId}/workflows
```

Exemplo de uso futuro:

```csharp
[Authorize(Policy = SystemPolicies.CanPublishInformative)]
[HttpPost("/api/areas/{areaId:guid}/informatives")]
public async Task<IActionResult> Create(Guid areaId, CreateInformativeRequest request)
{
    ...
}
```

### Authorization Handler

Arquivos:

```txt
src/Infrastructure/Authorization/AreaPermissionRequirement.cs
src/Infrastructure/Authorization/AreaPermissionHandler.cs
```

O `AreaPermissionHandler`:

```txt
1. Lê o UserId das claims.
2. Lê o areaId da rota.
3. Chama IPermissionService.
4. Marca a requirement como concluída se o usuário tiver permissão.
```

### PermissionService

Arquivo:

```txt
src/Infrastructure/Services/PermissionService.cs
```

Regras atuais:

```txt
SUPER_ADMIN:
Acesso total.

COMPANY_ADMIN:
Pode gerenciar/ver áreas da própria empresa.

Demais usuários:
Dependem dos registros ativos em user_area_accesses.
```

---

## JWT

Configuração no `appsettings.json`:

```json
{
  "Jwt": {
    "Issuer": "Sicou",
    "Audience": "Sicou",
    "Key": "SICOU_SUPER_SECRET_KEY_CHANGE_THIS_VALUE_IN_PRODUCTION_2026",
    "ExpirationInMinutes": 120
  }
}
```

Serviço:

```txt
src/Infrastructure/Services/JwtTokenService.cs
```

Interface:

```txt
src/Application/Interfaces/Auth/IJwtTokenService.cs
```

---

## Swagger com Bearer Token

Após fazer login, copiar o token retornado e clicar em:

```txt
Authorize
```

Informar:

```txt
Bearer SEU_TOKEN_AQUI
```

Depois disso, endpoints protegidos podem ser testados diretamente pelo Swagger.

---

## Entidades do Domínio

### BaseEntity

Arquivo:

```txt
src/Domain/Common/BaseEntity.cs
```

Campos:

```txt
Id
CreatedAt
UpdatedAt
IsActive
```

### Company

Arquivo:

```txt
src/Domain/Entities/Company.cs
```

Representa uma empresa no sistema.

Campos principais:

```txt
Name
Document
Units
Areas
```

Tabela:

```txt
companies
```

### Unit

Arquivo:

```txt
src/Domain/Entities/Unit.cs
```

Representa uma unidade vinculada a uma empresa.

Campos principais:

```txt
CompanyId
Company
Name
Code
City
State
```

Tabela:

```txt
units
```

### Area

Arquivo:

```txt
src/Domain/Entities/Area.cs
```

Representa uma área da sede.

Campos principais:

```txt
CompanyId
Company
Name
Slug
Description
AreaModules
```

Tabela:

```txt
areas
```

### Module

Arquivo:

```txt
src/Domain/Entities/Module.cs
```

Representa um módulo disponível no sistema.

Campos principais:

```txt
Code
Name
Description
AreaModules
```

Tabela:

```txt
modules
```

Observação: em alguns pontos do código, a entidade pode ser referenciada como:

```csharp
Sicou.Domain.Entities.Module
```

para evitar conflito com tipos internos do .NET.

### AreaModule

Arquivo:

```txt
src/Domain/Entities/AreaModule.cs
```

Representa o vínculo entre uma área e os módulos habilitados nela.

Campos principais:

```txt
AreaId
Area
ModuleId
Module
Enabled
```

Tabela:

```txt
area_modules
```

### UserAreaAccess

Arquivo:

```txt
src/Domain/Entities/UserAreaAccess.cs
```

Representa o acesso granular de um usuário a uma área da sede dentro de uma empresa e, opcionalmente, de uma unidade.

Campos principais:

```txt
UserId
CompanyId
Company
UnitId
Unit
AreaId
Area
CanView
CanManage
CanPublishInformatives
CanManageGuide
CanManageWorkflows
CanHandleWorkflowRequests
CreatedAt
UpdatedAt
IsActive
```

Tabela:

```txt
user_area_accesses
```

### Como interpretar UserAreaAccess

A entidade representa **um acesso específico por área**.

Exemplo:

```txt
Usuário João
Empresa: Empresa Sede Teste
Unidade: Unidade Campinas
Área: Jurídico
```

Isso gera um registro em `user_area_accesses`.

Se o mesmo usuário tiver acesso a três áreas, ele terá três registros.

```txt
João + Campinas + Jurídico
João + Campinas + Financeiro
João + Campinas + RH
```

Não foi usada uma lista de `AreaIds` dentro do usuário porque isso dificultaria:

```txt
Consultas por área
Índices únicos
Auditoria
Alteração de permissões por área
Remoção de acesso específico
Policies de autorização
```

### UnitId em UserAreaAccess

O campo `UnitId` é nullable de propósito.

```txt
Usuário da sede:
UnitId = null
AreaId = área da sede

Usuário de unidade:
UnitId = unidade do usuário
AreaId = área da sede com a qual ele pode interagir
```

O `AreaId` não significa que a unidade possui aquela área. Ele significa que o usuário pode interagir com aquela área da sede.

---

## Enum de Módulos

Arquivo:

```txt
src/Domain/Enums/ModuleCode.cs
```

Valores:

```txt
Informatives = 1
Guide = 2
Workflows = 3
```

Significados:

```txt
Informatives
Módulo de informativos, comunicados, arquivos e novidades.

Guide
Módulo orientador com botões, links, arquivos e orientações rápidas.

Workflows
Módulo de fluxos de trabalho e solicitações entre unidades e áreas da sede.
```

---

## Conversão de Enums no JSON

A API foi configurada para aceitar enums como string.

Exemplo aceito:

```json
{
  "moduleCodes": [
    "Informatives",
    "Guide",
    "Workflows"
  ]
}
```

Configuração no `Program.cs`:

```csharp
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
```

---

## Tabelas Criadas no Banco

Principais tabelas atuais:

```txt
users
roles
user_roles
user_claims
user_logins
role_claims
user_tokens
companies
units
areas
modules
area_modules
user_area_accesses
__EFMigrationsHistory
```

---

## Migrations Criadas

### InitialIdentitySetup

Criou as tabelas do Identity:

```txt
users
roles
user_roles
user_claims
user_logins
role_claims
user_tokens
```

### AddCoreDomainEntities

Criou as tabelas do domínio central:

```txt
companies
units
areas
modules
area_modules
```

Também inseriu os módulos iniciais:

```txt
Informativos
Orientador
Workflows
```

### AddUserAreaAccesses

Criou a tabela:

```txt
user_area_accesses
```

Com relacionamentos para:

```txt
companies
units
areas
```

Também criou índices para:

```txt
AreaId
CompanyId
UnitId
UserId
UserId + CompanyId + UnitId + AreaId
```

---

## Índices Importantes

```txt
IX_modules_Code
IX_areas_CompanyId_Slug
IX_units_CompanyId_Code
IX_area_modules_AreaId_ModuleId
IX_user_area_accesses_UserId_CompanyId_UnitId_AreaId
```

Esses índices impedem, por exemplo:

- duas áreas com o mesmo slug dentro da mesma empresa;
- dois módulos iguais na mesma área;
- dois códigos iguais de unidade dentro da mesma empresa;
- códigos duplicados de módulos;
- acesso granular duplicado para o mesmo usuário, empresa, unidade e área.

---

## Endpoints de Autenticação

Controller:

```txt
src/Api/Controllers/AuthController.cs
```

### Registrar usuário

```http
POST /api/Auth/register
```

Exemplo:

```json
{
  "fullName": "Administrador Sicou",
  "email": "admin@sicou.com",
  "password": "Admin123",
  "companyId": null,
  "unitId": null
}
```

### Login

```http
POST /api/Auth/login
```

Exemplo:

```json
{
  "email": "admin@sicou.com",
  "password": "Admin123"
}
```

Resposta esperada:

```json
{
  "accessToken": "...",
  "expiresAt": "...",
  "user": {
    "id": "...",
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

### Usuário atual

```http
GET /api/Auth/me
```

Requer autenticação.

---

## Endpoint Temporário de Setup

Controller:

```txt
src/Api/Controllers/AdminSetupController.cs
```

Endpoint:

```http
POST /api/admin-setup/promote-super-admin?email=admin@sicou.com
```

Esse endpoint foi criado para promover o usuário inicial para `SUPER_ADMIN`.

> Importante: esse endpoint é temporário e deve ser removido ou protegido antes de qualquer ambiente produtivo.

---

## Endpoints de Teste de Segurança

Controller:

```txt
src/Api/Controllers/SecurityTestController.cs
```

### Teste autenticado

```http
GET /api/security-test/authenticated
```

Requer qualquer usuário autenticado.

### Teste SUPER_ADMIN

```http
GET /api/security-test/super-admin
```

Requer role:

```txt
SUPER_ADMIN
```

---

## CRUD de Companies

Controller:

```txt
src/Api/Controllers/CompaniesController.cs
```

Proteção atual:

```csharp
[Authorize(Roles = SystemRoles.SuperAdmin)]
```

Endpoints:

```http
POST   /api/companies
GET    /api/companies
GET    /api/companies/{id}
PUT    /api/companies/{id}
DELETE /api/companies/{id}
```

### Criar empresa

```http
POST /api/companies
```

Exemplo:

```json
{
  "name": "Empresa Sede Teste",
  "document": "12345678000199"
}
```

### Camadas criadas para Company

```txt
CreateCompanyRequest
UpdateCompanyRequest
CompanyResponse
ICompanyRepository
CompanyRepository
ICompanyService
CompanyService
CompaniesController
```

---

## CRUD de Units

Controller:

```txt
src/Api/Controllers/UnitsController.cs
```

Proteção atual:

```csharp
[Authorize(Roles = SystemRoles.SuperAdmin)]
```

Endpoints:

```http
POST   /api/companies/{companyId}/units
GET    /api/companies/{companyId}/units
GET    /api/units/{id}
PUT    /api/units/{id}
DELETE /api/units/{id}
```

### Criar unidade

```http
POST /api/companies/{companyId}/units
```

Exemplo:

```json
{
  "name": "Unidade Campinas",
  "code": "CAMPINAS",
  "city": "Campinas",
  "state": "SP"
}
```

### Camadas criadas para Unit

```txt
CreateUnitRequest
UpdateUnitRequest
UnitResponse
IUnitRepository
UnitRepository
IUnitService
UnitService
UnitsController
```

---

## CRUD de Areas

Controller:

```txt
src/Api/Controllers/AreasController.cs
```

Proteção atual:

```csharp
[Authorize(Roles = SystemRoles.SuperAdmin)]
```

Endpoints:

```http
POST   /api/companies/{companyId}/areas
GET    /api/companies/{companyId}/areas
GET    /api/areas/{id}
PUT    /api/areas/{id}
DELETE /api/areas/{id}
PUT    /api/areas/{id}/modules
```

### Criar área

```http
POST /api/companies/{companyId}/areas
```

Exemplo:

```json
{
  "name": "Jurídico",
  "description": "Área responsável por demandas jurídicas.",
  "moduleCodes": [
    "Informatives",
    "Guide",
    "Workflows"
  ]
}
```

### Atualizar módulos de uma área

```http
PUT /api/areas/{id}/modules
```

Exemplo:

```json
{
  "moduleCodes": [
    "Informatives",
    "Guide"
  ]
}
```

### Camadas criadas para Area

```txt
CreateAreaRequest
UpdateAreaRequest
UpdateAreaModulesRequest
AreaResponse
AreaModuleResponse
IAreaRepository
AreaRepository
IAreaService
AreaService
AreasController
```

---

## CRUD de UserAreaAccess

Controller:

```txt
src/Api/Controllers/UserAreaAccessesController.cs
```

Proteção atual:

```csharp
[Authorize(Roles = $"{SystemRoles.SuperAdmin},{SystemRoles.CompanyAdmin}")]
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

### Criar acesso granular

```http
POST /api/user-area-accesses
```

Exemplo com usuário da sede:

```json
{
  "userId": "fbe6359e-994c-49b9-b554-53ecb0ecbe00",
  "companyId": "666436f4-6b89-4209-a21b-84d5a58159aa",
  "unitId": null,
  "areaId": "27288367-9ac1-42c8-b3ca-6b60a807af76",
  "canView": true,
  "canManage": false,
  "canPublishInformatives": true,
  "canManageGuide": false,
  "canManageWorkflows": false,
  "canHandleWorkflowRequests": true
}
```

Exemplo com usuário de unidade:

```json
{
  "userId": "id-do-usuario",
  "companyId": "id-da-empresa",
  "unitId": "id-da-unidade",
  "areaId": "id-da-area-da-sede",
  "canView": true,
  "canManage": false,
  "canPublishInformatives": false,
  "canManageGuide": false,
  "canManageWorkflows": false,
  "canHandleWorkflowRequests": true
}
```

### Camadas criadas para UserAreaAccess

```txt
CreateUserAreaAccessRequest
UpdateUserAreaAccessRequest
UserAreaAccessResponse
IUserAreaAccessRepository
UserAreaAccessRepository
IUserAreaAccessService
UserAreaAccessService
UserAreaAccessesController
```

### Testes realizados

Foram validados:

```txt
POST: 201 Created
GET por ID: 200 OK
GET por usuário: 200 OK
GET por empresa: 200 OK
PUT: 200 OK
DELETE: 204 No Content
GET após delete: 404 Not Found
```

---

## CRUD Administrativo de Users

Controller:

```txt
src/Api/Controllers/UsersController.cs
```

Proteção atual:

```csharp
[Authorize(Roles = $"{SystemRoles.SuperAdmin},{SystemRoles.CompanyAdmin}")]
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

### Criar usuário administrativo

```http
POST /api/users
```

Exemplo:

```json
{
  "fullName": "Usuário Unidade Campinas",
  "email": "usuario.campinas@sicou.com",
  "password": "Admin123",
  "companyId": "id-da-empresa",
  "unitId": "id-da-unidade",
  "roles": [
    "UNIT_USER"
  ]
}
```

### Atualizar usuário

```http
PUT /api/users/{id}
```

Exemplo:

```json
{
  "fullName": "Usuário Atualizado",
  "companyId": "id-da-empresa",
  "unitId": "id-da-unidade",
  "isActive": true
}
```

### Atualizar roles

```http
PUT /api/users/{id}/roles
```

Exemplo:

```json
{
  "roles": [
    "AREA_ADMIN",
    "HEADQUARTER_USER"
  ]
}
```

### Camadas criadas para Users

```txt
CreateUserRequest
UpdateUserRequest
UpdateUserRolesRequest
UserResponse
IUserService
UserService
UsersController
```

### Observação técnica importante

No projeto atual, `ApplicationUser.Id` é `Guid`. No `UserResponse`, o `Id` é retornado como `string`. Por isso, no mapper do `UserService`, foi necessário usar:

```csharp
Id = user.Id.ToString()
```

---

## Endpoints de Teste de Policies por Área

Controller:

```txt
src/Api/Controllers/AreaPolicyTestController.cs
```

Endpoints:

```http
GET /api/area-policy-test/{areaId}/can-view
GET /api/area-policy-test/{areaId}/can-manage
GET /api/area-policy-test/{areaId}/can-publish-informative
GET /api/area-policy-test/{areaId}/can-manage-guide
GET /api/area-policy-test/{areaId}/can-manage-workflow
GET /api/area-policy-test/{areaId}/can-handle-workflow
```

Esse controller foi criado apenas para validar a estrutura de policies antes dos módulos reais.

Recomendação:

```txt
Manter temporariamente enquanto os módulos Informativos, Orientador e Workflows ainda não existem.
Remover quando as policies estiverem aplicadas em endpoints reais.
```

---

## Fluxo Atual de Cadastro e Configuração

O fluxo atual já suportado é:

```txt
1. Criar usuário admin
2. Promover usuário para SUPER_ADMIN
3. Fazer login
4. Usar Swagger com Bearer Token
5. Criar empresa
6. Criar unidades da empresa
7. Criar áreas da sede
8. Definir módulos ativos da área
9. Criar usuários administrativos
10. Atribuir roles aos usuários
11. Criar acessos granulares por usuário, empresa, unidade e área
12. Validar policies por área
```

---

## Comandos Úteis

### Restaurar pacotes

```powershell
dotnet restore
```

### Compilar solução

```powershell
dotnet build
```

### Rodar API

```powershell
dotnet run --project src/Api/Sicou.Api.csproj
```

### Criar migration

```powershell
dotnet ef migrations add NomeDaMigration --project src/Infrastructure/Sicou.Infrastructure.csproj --startup-project src/Api/Sicou.Api.csproj --context ApplicationDbContext --output-dir Data/Migrations
```

### Aplicar migrations no banco

```powershell
dotnet ef database update --project src/Infrastructure/Sicou.Infrastructure.csproj --startup-project src/Api/Sicou.Api.csproj --context ApplicationDbContext
```

### Ver versão do EF Tool

```powershell
dotnet ef --version
```

Versão usada:

```txt
8.0.0
```

---

## Como Rodar o Projeto Localmente

### 1. Entrar na pasta do backend

```powershell
cd C:\Users\kinha\sicou\backend
```

### 2. Conferir PostgreSQL

Garantir que o PostgreSQL esteja rodando localmente.

### 3. Criar banco

```sql
CREATE DATABASE sicou_db;
```

### 4. Configurar connection string

Editar:

```txt
src/Api/appsettings.json
```

Exemplo:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=sicou_db;Username=postgres;Password=sua_senha"
  }
}
```

### 5. Restaurar pacotes

```powershell
dotnet restore
```

### 6. Aplicar migrations

```powershell
dotnet ef database update --project src/Infrastructure/Sicou.Infrastructure.csproj --startup-project src/Api/Sicou.Api.csproj --context ApplicationDbContext
```

### 7. Rodar API

```powershell
dotnet run --project src/Api/Sicou.Api.csproj
```

### 8. Acessar Swagger

Exemplo:

```txt
http://localhost:5175/swagger
```

---

## Decisões Técnicas Atuais

### Soft delete

`DELETE` não remove fisicamente os registros principais.

Em vez disso:

```txt
IsActive = false
UpdatedAt = DateTime.UtcNow
```

### Slug de Area

O slug da área é gerado automaticamente a partir do nome.

Exemplo:

```txt
Jurídico -> juridico
```

Esse slug é único por empresa.

### Módulos por área

Os módulos não ficam diretamente na tabela `areas`.

Eles são vinculados pela tabela:

```txt
area_modules
```

Isso permite que cada área tenha apenas os módulos que fizerem sentido.

### Permissões por área

A governança granular foi modelada com a tabela:

```txt
user_area_accesses
```

Cada registro representa:

```txt
Usuário + Empresa + Unidade opcional + Área + Permissões
```

### Policies por areaId

As policies por área dependem de rotas que contenham:

```txt
{areaId}
```

Se a rota usar apenas `{id}`, o handler não conseguirá identificar a área.

---

## Estado Atual Validado

Foram testados com sucesso:

```txt
Register
Login
Me
Swagger com Bearer Token
Endpoint protegido por autenticação
Endpoint protegido por role SUPER_ADMIN
CRUD completo de Company
CRUD completo de Unit
Criação e listagem de Area com módulos
Atualização de módulos de Area
CRUD completo de UserAreaAccess
Soft delete de UserAreaAccess
CRUD administrativo de Users
Atualização de roles de Users
Policies por AreaId com SUPER_ADMIN
```

---

## Próximos Passos Recomendados no Backend

### Etapa 13 — Módulo de Informativos

Objetivo:

```txt
Permitir que áreas da sede publiquem informativos para usuários da sede e/ou unidades.
```

Entidades sugeridas:

```txt
Informative
InformativeAttachment
```

Campos sugeridos para `Informative`:

```txt
Id
CompanyId
AreaId
Title
Summary
Content
Status
PublishedAt
CreatedByUserId
UpdatedByUserId
CreatedAt
UpdatedAt
IsActive
```

Status sugeridos:

```txt
Draft
Published
Archived
```

Campos sugeridos para `InformativeAttachment`:

```txt
Id
InformativeId
FileName
OriginalFileName
ContentType
FilePath
FileSize
CreatedAt
UpdatedAt
IsActive
```

Funcionalidades:

```txt
Criar informativo como rascunho
Editar informativo
Publicar informativo
Arquivar informativo
Listar informativos por área
Buscar informativo por ID
Anexar arquivos futuramente
Aplicar policy CanPublishInformative para publicação
Aplicar policy CanViewArea para leitura por área
```

Endpoints sugeridos:

```http
POST   /api/areas/{areaId}/informatives
GET    /api/areas/{areaId}/informatives
GET    /api/informatives/{id}
PUT    /api/informatives/{id}
DELETE /api/informatives/{id}
POST   /api/informatives/{id}/publish
POST   /api/informatives/{id}/archive
```

Sugestão de implementação incremental:

```txt
13.1 Criar enum InformativeStatus
13.2 Criar entidade Informative
13.3 Mapear no ApplicationDbContext
13.4 Criar migration
13.5 Criar requests/responses
13.6 Criar repository
13.7 Criar service
13.8 Registrar dependências
13.9 Criar controller
13.10 Aplicar policies
13.11 Testar no Swagger
```

### Etapa 14 — Módulo Orientador

Objetivo:

```txt
Permitir que áreas configurem botões/itens de orientação para unidades e usuários.
```

Entidade sugerida:

```txt
GuideItem
```

Possíveis tipos:

```txt
Link
File
Text
Workflow
```

Campos sugeridos:

```txt
Id
CompanyId
AreaId
Title
Description
Type
Url
Content
FilePath
WorkflowDefinitionId
DisplayOrder
CreatedByUserId
UpdatedByUserId
CreatedAt
UpdatedAt
IsActive
```

Funcionalidades:

```txt
Criar item orientador
Editar item orientador
Listar itens por área
Ordenar itens
Ativar/inativar itens
Vincular link, texto, arquivo ou workflow
Aplicar policy CanManageGuide
```

Endpoints sugeridos:

```http
POST   /api/areas/{areaId}/guide-items
GET    /api/areas/{areaId}/guide-items
GET    /api/guide-items/{id}
PUT    /api/guide-items/{id}
DELETE /api/guide-items/{id}
PUT    /api/areas/{areaId}/guide-items/order
```

### Etapa 15 — Módulo de Workflows

Objetivo:

```txt
Permitir que a sede configure fluxos de trabalho e que unidades abram solicitações para as áreas.
```

Entidades sugeridas:

```txt
WorkflowDefinition
WorkflowFieldDefinition
WorkflowStepDefinition
WorkflowInstance
WorkflowInstanceValue
WorkflowInstanceHistory
WorkflowAttachment
```

Funcionalidades iniciais:

```txt
Criar definição de workflow
Configurar campos dinâmicos
Ativar/inativar workflow
Unidade abrir solicitação
Área receber solicitação
Atualizar status
Registrar histórico
Anexar arquivos futuramente
```

Estados sugeridos:

```txt
Draft
Active
Inactive
Open
InProgress
WaitingAdjustment
Completed
Canceled
Rejected
```

Policies esperadas:

```txt
CanManageWorkflow
CanHandleWorkflow
CanViewArea
```

### Etapa 16 — Upload de Arquivos

Objetivo:

```txt
Criar serviço de storage para anexos de informativos, orientador e workflows.
```

Implementação inicial sugerida:

```txt
Storage local em wwwroot/uploads
```

Evoluções futuras:

```txt
S3
Azure Blob Storage
Google Cloud Storage
MinIO
```

Abstração sugerida:

```txt
IFileStorageService
LocalFileStorageService
```

### Etapa 17 — Melhorias Técnicas

Sugestões:

```txt
Criar UnitOfWork
Criar filtros globais para IsActive
Criar middleware global de tratamento de exceções
Criar padronização de respostas da API
Adicionar FluentValidation nos requests
Adicionar logs estruturados
Adicionar paginação
Adicionar auditoria
Adicionar testes unitários
Adicionar testes de integração
Adicionar Docker Compose para PostgreSQL
```

### Etapa 18 — Segurança e Produção

Antes de produção, revisar:

```txt
Remover ou proteger AdminSetupController
Remover AreaPolicyTestController
Trocar Jwt:Key por secret seguro
Mover secrets para variáveis de ambiente
Adicionar HTTPS obrigatório
Adicionar CORS configurado para o frontend
Adicionar política de senha definitiva
Adicionar refresh token
Adicionar controle de expiração e revogação de tokens
Adicionar auditoria de login
Adicionar bloqueio e desbloqueio de usuários
Restringir COMPANY_ADMIN à própria empresa em todos os endpoints
Adicionar validações de escopo por companyId
```

---

## Observações de Segurança

Pontos importantes ainda pendentes:

```txt
AdminSetupController é temporário.
AreaPolicyTestController é temporário.
JWT Key atual é apenas para desenvolvimento.
Ainda não existe refresh token.
Ainda não existe middleware global de exceptions.
Ainda não existe política final de CORS para o frontend.
Ainda não existe auditoria completa.
COMPANY_ADMIN ainda precisa de restrição forte por empresa nos controllers administrativos.
```

---

## Status Atual

```txt
Backend central inicial:
OK

Autenticação:
OK

Autorização por roles:
OK

Policies granulares por área:
OK

Domínio central:
OK

CRUD Company:
OK

CRUD Unit:
OK

CRUD Area com módulos:
OK

Governança granular UserAreaAccess:
OK

CRUD administrativo de Users:
OK

Próximo foco:
Etapa 13 — Módulo de Informativos
```

---

## Resumo Conceitual do Sicou

O Sicou será uma plataforma para permitir que a sede de uma empresa organize e governe a comunicação, orientação e execução de processos junto às suas unidades.

A base atual já permite configurar:

```txt
Empresas
Unidades
Áreas da sede
Módulos habilitados por área
Usuários autenticados
Roles administrativas
Permissões granulares por área
Policies de autorização por área
```

A partir dessa fundação, os próximos módulos poderão ser construídos de forma incremental:

```txt
Informativos
Orientador
Workflows
Arquivos
Notificações
Dashboards
Auditoria
Frontend React/Tailwind
```

