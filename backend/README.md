# Sicou Backend

Backend do **Sicou**, um sistema voltado para organização, governança e centralização de processos entre uma sede administrativa e suas unidades.

O objetivo do sistema é permitir que empresas com estrutura de **sede e unidades** possam criar áreas internas da sede, configurar módulos disponíveis para cada área e disponibilizar informações, orientações e fluxos de trabalho para as unidades.

---

## Visão Geral do Projeto

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

Cada área da sede poderá ter seus próprios módulos habilitados. Nem toda área precisa possuir todos os módulos.

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

---

## Estrutura Atual da Solução

```txt
backend/
├── Sicou.sln
├── README.md
├── src/
│   ├── Api/
│   │   ├── Controllers/
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   └── Sicou.Api.csproj
│   │
│   ├── Application/
│   │   ├── Interfaces/
│   │   │   ├── Auth/
│   │   │   ├── Repositories/
│   │   │   └── Services/
│   │   ├── Requests/
│   │   │   ├── Auth/
│   │   │   ├── Companies/
│   │   │   ├── Units/
│   │   │   └── Areas/
│   │   ├── Responses/
│   │   │   ├── Auth/
│   │   │   ├── Companies/
│   │   │   ├── Units/
│   │   │   └── Areas/
│   │   └── Sicou.Application.csproj
│   │
│   ├── Domain/
│   │   ├── Common/
│   │   ├── Constants/
│   │   ├── Entities/
│   │   ├── Enums/
│   │   └── Sicou.Domain.csproj
│   │
│   └── Infrastructure/
│       ├── Data/
│       ├── Extensions/
│       ├── Identity/
│       ├── Repositories/
│       ├── Seed/
│       ├── Services/
│       └── Sicou.Infrastructure.csproj
│
└── tests/
    ├── Sicou.UnitTests/
    └── Sicou.IntegrationTests/
```

---

## Arquitetura

O backend segue uma arquitetura em camadas.

```txt
Api
↓
Application
↓
Infrastructure
↓
Domain
```

### Api

Camada de entrada da aplicação.

Responsável por:

- Controllers
- Rotas HTTP
- Autenticação JWT
- Autorização
- Swagger
- Configuração inicial da aplicação

### Application

Camada de contratos e modelos de aplicação.

Responsável por:

- Interfaces de serviços
- Interfaces de repositories
- Requests
- Responses
- DTOs de entrada e saída

Essa camada não acessa diretamente banco de dados.

### Domain

Camada de domínio.

Responsável por:

- Entidades principais
- Enums
- Constantes
- BaseEntity
- Regras estruturais do domínio

Essa camada não depende de nenhuma outra camada.

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
- Integração com PostgreSQL

---

## Projetos da Solution

A solution atual possui os seguintes projetos:

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

## Pacotes Principais

### Infrastructure

- Microsoft.EntityFrameworkCore
- Microsoft.EntityFrameworkCore.Design
- Npgsql.EntityFrameworkCore.PostgreSQL
- Microsoft.AspNetCore.Identity.EntityFrameworkCore
- System.IdentityModel.Tokens.Jwt
- Microsoft.IdentityModel.Tokens

### Api

- Microsoft.AspNetCore.Authentication.JwtBearer
- Microsoft.EntityFrameworkCore.Design
- Swashbuckle.AspNetCore

### Application

- FluentValidation
- FluentValidation.DependencyInjectionExtensions

---

## Banco de Dados

Banco utilizado:

```txt
PostgreSQL
```

Banco local criado:

```txt
sicou_db
```

Exemplo de connection string usada no `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=sicou_db;Username=postgres;Password=sua_senha"
  }
}
```

---

## Autenticação e Autorização

O projeto utiliza:

- ASP.NET Core Identity
- JWT Bearer Token
- Roles do Identity
- Proteção de endpoints com `[Authorize]`

### Usuário Identity

Classe:

```txt
ApplicationUser
```

Campos customizados adicionados:

```txt
FullName
IsActive
CreatedAt
UpdatedAt
CompanyId
UnitId
```

### Role Identity

Classe:

```txt
ApplicationRole
```

Campos customizados adicionados:

```txt
Description
IsSystemRole
CreatedAt
```

---

## Roles Iniciais

As roles iniciais do sistema são:

```txt
SUPER_ADMIN
COMPANY_ADMIN
AREA_ADMIN
HEADQUARTER_USER
UNIT_USER
```

Elas ficam centralizadas em:

```txt
src/Domain/Constants/SystemRoles.cs
```

### Descrição das Roles

```txt
SUPER_ADMIN
Administrador geral do sistema.

COMPANY_ADMIN
Administrador de uma empresa.

AREA_ADMIN
Administrador de uma área da sede.

HEADQUARTER_USER
Usuário operacional da sede.

UNIT_USER
Usuário operacional de uma unidade.
```

---

## Seed de Roles

O seed de roles é executado na inicialização da aplicação.

Arquivo:

```txt
src/Infrastructure/Seed/IdentitySeeder.cs
```

No `Program.cs`, o seed é chamado após a criação da aplicação:

```csharp
await IdentitySeeder.SeedRolesAsync(app.Services);
```

---

## JWT

A configuração do JWT fica em:

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

O serviço responsável por gerar tokens é:

```txt
src/Infrastructure/Services/JwtTokenService.cs
```

Interface:

```txt
src/Application/Interfaces/Auth/IJwtTokenService.cs
```

---

## Swagger com Bearer Token

O Swagger está configurado para aceitar autenticação via Bearer Token.

Após fazer login, copie o token retornado e clique em:

```txt
Authorize
```

Informe:

```txt
Bearer SEU_TOKEN_AQUI
```

Depois disso, endpoints protegidos podem ser testados diretamente pelo Swagger.

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

## Entidades do Domínio Criadas

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

Esses valores representam:

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

Essa configuração fica no `Program.cs`:

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

Até o momento, as principais tabelas criadas são:

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

---

## Índices Importantes

Foram criados índices únicos para proteger integridade do domínio:

```txt
IX_modules_Code
IX_areas_CompanyId_Slug
IX_units_CompanyId_Code
IX_area_modules_AreaId_ModuleId
```

Esses índices impedem, por exemplo:

- duas áreas com o mesmo slug dentro da mesma empresa;
- dois módulos iguais na mesma área;
- dois códigos iguais de unidade dentro da mesma empresa;
- códigos duplicados de módulos.

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

Resposta esperada:

```json
{
  "id": "...",
  "name": "Empresa Sede Teste",
  "document": "12345678000199",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": null
}
```

### Camadas criadas para Company

Requests:

```txt
CreateCompanyRequest
UpdateCompanyRequest
```

Response:

```txt
CompanyResponse
```

Repository:

```txt
ICompanyRepository
CompanyRepository
```

Service:

```txt
ICompanyService
CompanyService
```

Controller:

```txt
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

Resposta esperada:

```json
{
  "id": "...",
  "companyId": "...",
  "companyName": "Empresa Sede Teste",
  "name": "Unidade Campinas",
  "code": "CAMPINAS",
  "city": "Campinas",
  "state": "SP",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": null
}
```

### Camadas criadas para Unit

Requests:

```txt
CreateUnitRequest
UpdateUnitRequest
```

Response:

```txt
UnitResponse
```

Repository:

```txt
IUnitRepository
UnitRepository
```

Service:

```txt
IUnitService
UnitService
```

Controller:

```txt
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

Resposta esperada:

```json
{
  "id": "...",
  "companyId": "...",
  "companyName": "Empresa Sede Teste",
  "name": "Jurídico",
  "slug": "juridico",
  "description": "Área responsável por demandas jurídicas.",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": null,
  "modules": [
    {
      "moduleId": "11111111-1111-1111-1111-111111111111",
      "code": "Informatives",
      "name": "Informativos",
      "enabled": true
    },
    {
      "moduleId": "22222222-2222-2222-2222-222222222222",
      "code": "Guide",
      "name": "Orientador",
      "enabled": true
    },
    {
      "moduleId": "33333333-3333-3333-3333-333333333333",
      "code": "Workflows",
      "name": "Workflows",
      "enabled": true
    }
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

Requests:

```txt
CreateAreaRequest
UpdateAreaRequest
UpdateAreaModulesRequest
```

Responses:

```txt
AreaResponse
AreaModuleResponse
```

Repository:

```txt
IAreaRepository
AreaRepository
```

Service:

```txt
IAreaService
AreaService
```

Controller:

```txt
AreasController
```

---

## Fluxo Atual de Cadastro

O fluxo atual já suportado é:

```txt
1. Criar usuário admin
2. Promover usuário para SUPER_ADMIN
3. Fazer login
4. Criar empresa
5. Criar unidades da empresa
6. Criar áreas da empresa
7. Definir módulos ativos da área
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

A URL será exibida no terminal.

Exemplo:

```txt
http://localhost:5175/swagger
```

---

## Decisões Técnicas Atuais

### Soft delete

Até o momento, `DELETE` não remove fisicamente registros principais.

Em vez disso, atualiza:

```txt
IsActive = false
UpdatedAt = DateTime.UtcNow
```

Isso está sendo usado em:

```txt
Company
Unit
Area
```

### Slug de Area

O slug da área é gerado automaticamente a partir do nome.

Exemplo:

```txt
Jurídico
```

vira:

```txt
juridico
```

Esse slug é único por empresa.

### Módulos por área

Os módulos não ficam diretamente na tabela `areas`.

Eles são vinculados pela tabela:

```txt
area_modules
```

Isso permite que cada área tenha apenas os módulos que fizerem sentido.

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
Criação de Area com módulos
```

---

## Próximos Passos Recomendados

### Etapa 10 — Governança de usuários e acessos

Criar estrutura para permissões granulares por empresa, unidade e área.

Entidade sugerida:

```txt
UserAreaAccess
```

Campos sugeridos:

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
CreatedAt
UpdatedAt
IsActive
```

Objetivo:

```txt
Permitir que administradores deleguem acessos específicos a usuários.
```

Exemplo:

```txt
Usuário João
Empresa: Empresa Sede Teste
Unidade: Unidade Campinas
Área: Jurídico

Permissões:
- Pode visualizar
- Pode abrir workflows
- Não pode publicar informativos
- Não pode gerenciar módulos
```

### Etapa 11 — CRUD administrativo de usuários

Criar endpoints para administradores gerenciarem usuários.

Endpoints sugeridos:

```http
POST   /api/users
GET    /api/users
GET    /api/users/{id}
PUT    /api/users/{id}
DELETE /api/users/{id}
PUT    /api/users/{id}/roles
PUT    /api/users/{id}/area-accesses
```

### Etapa 12 — Políticas de autorização

Atualmente usamos roles globais.

Próximo passo será criar policies, por exemplo:

```txt
CanManageCompany
CanManageArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

Isso permitirá proteger endpoints não apenas por role, mas também por acesso granular.

### Etapa 13 — Módulo de Informativos

Criar entidades:

```txt
Informative
InformativeAttachment
```

Funcionalidades:

```txt
Criar informativo
Editar informativo
Publicar informativo
Arquivar informativo
Listar feed por área
Anexar arquivos
Controle de visibilidade
```

Endpoints sugeridos:

```http
POST   /api/areas/{areaId}/informatives
GET    /api/areas/{areaId}/informatives
GET    /api/informatives/{id}
PUT    /api/informatives/{id}
DELETE /api/informatives/{id}
POST   /api/informatives/{id}/publish
```

### Etapa 14 — Módulo Orientador

Criar entidade:

```txt
GuideItem
```

Possíveis tipos de ação:

```txt
Link
File
Text
Workflow
```

Funcionalidades:

```txt
Criar botão orientador
Ordenar botões
Ativar/inativar botões
Vincular link, texto, arquivo ou workflow
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

Criar entidades base:

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
Unidade abrir solicitação
Área receber solicitação
Atualizar status
Registrar histórico
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

### Etapa 16 — Upload de arquivos

Criar serviço de storage para anexos.

Inicialmente pode ser local:

```txt
wwwroot/uploads
```

Depois pode evoluir para:

```txt
S3
Azure Blob Storage
Google Cloud Storage
MinIO
```

### Etapa 17 — Melhorias técnicas

Sugestões de evolução:

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

---

## Observações de Segurança

Antes de produção, revisar:

```txt
Remover ou proteger AdminSetupController
Trocar Jwt:Key por secret seguro
Mover secrets para variáveis de ambiente
Adicionar HTTPS obrigatório
Adicionar CORS configurado para o frontend
Adicionar política de senha definitiva
Adicionar refresh token
Adicionar controle de expiração e revogação de tokens
Adicionar auditoria de login
Adicionar bloqueio e desbloqueio de usuários
```

---

## Status Atual

```txt
Backend central inicial concluído.

Base técnica:
OK

Autenticação:
OK

Autorização inicial:
OK

Domínio central:
OK

CRUD Company:
OK

CRUD Unit:
OK

CRUD Area com módulos:
OK

Próximo foco:
Governança granular de usuários e permissões.
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
```

A partir dessa fundação, os próximos módulos poderão ser construídos de forma incremental:

```txt
Informativos
Orientador
Workflows
Permissões granulares
Arquivos
Notificações
Dashboards
```
