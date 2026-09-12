# Sicou Frontend

Frontend administrativo do **Sicou**, uma plataforma de governança operacional para empresas que possuem uma estrutura com **sede administrativa**, **áreas internas** e **unidades operacionais**.

Este README representa o estado atual do frontend após a integração inicial com o backend, implementação dos principais cadastros administrativos e padronização dos componentes visuais reutilizáveis.

Atualizado em: **14/06/2026**

---

## 1. Visão geral do sistema

O Sicou está sendo desenvolvido para organizar a comunicação e a operação entre a sede de uma empresa e suas unidades.

A estrutura conceitual atual é:

```txt
Empresa
├── Unidades
└── Áreas da sede
    ├── Informativos
    ├── Orientador
    └── Workflows
```

A sede administrativa cadastra empresas, unidades, áreas, usuários e permissões. Cada área da sede pode ter módulos habilitados, permitindo que futuramente o sistema evolua para publicação de informativos, construção de orientações operacionais e abertura/tratamento de workflows pelas unidades.

---

## 2. Stack do frontend

O frontend atual utiliza:

```txt
React 19
TypeScript
Vite 8
Tailwind CSS 4
React Router 7
lucide-react
clsx
tailwind-merge
ESLint
Fetch API nativa
```

Scripts disponíveis:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

---

## 3. Pré-requisitos

Antes de rodar o frontend, é esperado que o backend esteja disponível localmente.

Backend esperado:

```txt
http://localhost:5175
```

Frontend esperado:

```txt
http://localhost:5173
```

Arquivo de ambiente atual:

```txt
.env.development
```

Conteúdo atual:

```env
VITE_API_BASE_URL=http://localhost:5175
```

---

## 4. Como rodar o projeto

Instale as dependências:

```bash
npm install
```

Rode em desenvolvimento:

```bash
npm run dev
```

Valide o lint:

```bash
npm run lint
```

Gere build de produção:

```bash
npm run build
```

---

## 5. Estrutura atual de pastas

A estrutura foi organizada por camadas de aplicação e features de domínio.

```txt
src
├── app
│   ├── config
│   ├── layouts
│   ├── pages
│   ├── providers
│   └── router
├── features
│   ├── areas
│   ├── auth
│   ├── companies
│   ├── units
│   └── users
├── shared
│   ├── api
│   ├── components
│   ├── constants
│   └── utils
├── App.tsx
├── index.css
└── main.tsx
```

### 5.1 Camada `app`

Responsável pela estrutura global da aplicação:

```txt
src/app/config/env.ts
src/app/layouts/AdminLayout.tsx
src/app/pages/DashboardPage.tsx
src/app/pages/ComingSoonPage.tsx
src/app/providers/AppProviders.tsx
src/app/router/AppRouter.tsx
src/app/router/ProtectedRoute.tsx
```

Principais responsabilidades:

- Configuração de variáveis de ambiente.
- Definição das rotas.
- Layout administrativo.
- Proteção de rotas autenticadas.
- Páginas globais, como Dashboard e Coming Soon.
- Provider global de autenticação.

### 5.2 Camada `features`

Cada domínio funcional fica isolado em sua própria feature.

Padrão atual das features:

```txt
feature
├── api
├── components
├── pages
├── types
└── index.ts
```

Nem todas as features possuem todas as pastas. Por exemplo, `units` e `areas` hoje são renderizadas dentro dos detalhes de empresa, então não possuem página própria isolada.

### 5.3 Camada `shared`

Contém recursos compartilhados entre as features:

```txt
src/shared/api/apiFetch.ts
src/shared/components/ActionsDropdown.tsx
src/shared/components/SelectDropdown.tsx
src/shared/constants/roles.ts
src/shared/constants/storageKeys.ts
src/shared/utils/cn.ts
```

---

## 6. Rotas atuais

As rotas estão definidas em:

```txt
src/app/router/AppRouter.tsx
```

Rotas disponíveis:

```txt
/                         -> redireciona para /app/dashboard
/login                    -> login
/app                      -> layout administrativo protegido
/app/dashboard            -> dashboard administrativo
/app/companies            -> gestão de empresas
/app/companies/:companyId -> detalhes da empresa, unidades e áreas
/app/users                -> gestão de usuários
/app/access-control       -> placeholder de permissões granulares
*                         -> redireciona para /app/dashboard
```

A rota `/app` é protegida por autenticação via `ProtectedRoute`.

---

## 7. Autenticação

A autenticação já está integrada ao backend via JWT.

Arquivos principais:

```txt
src/features/auth/api/authApi.ts
src/features/auth/lib/authStorage.ts
src/features/auth/providers/AuthProvider.tsx
src/features/auth/providers/AuthContext.ts
src/features/auth/providers/useAuth.ts
src/features/auth/types/authTypes.ts
src/features/auth/pages/LoginPage.tsx
```

Endpoints consumidos:

```txt
POST /api/Auth/login
GET  /api/Auth/me
```

O frontend armazena a sessão usando `localStorage` com as chaves:

```txt
sicou.accessToken
sicou.expiresAt
sicou.user
```

O fluxo atual é:

1. Usuário acessa `/login`.
2. Front envia e-mail e senha para o backend.
3. Backend retorna `accessToken`, `expiresAt` e dados do usuário.
4. Front salva a sessão no `localStorage`.
5. Rotas protegidas passam a ser acessíveis.
6. Ao recarregar a aplicação, o `AuthProvider` valida a sessão usando `/api/Auth/me`.
7. Em caso de `401`, a sessão é limpa e o usuário é redirecionado para `/login`.

---

## 8. Cliente HTTP centralizado

Todas as chamadas HTTP passam por:

```txt
src/shared/api/apiFetch.ts
```

Responsabilidades do `apiFetch`:

- Usar `VITE_API_BASE_URL` como base da API.
- Adicionar `Content-Type: application/json`.
- Adicionar `Authorization: Bearer <token>` quando a chamada exige autenticação.
- Permitir chamadas sem token usando `auth: false`.
- Tratar `401` limpando sessão e redirecionando para login.
- Tratar `403` com mensagem de permissão.
- Extrair mensagens de erro de `message`, `title`, `detail` ou `errors`.
- Retornar `undefined` em respostas `204`.

---

## 9. Layout administrativo

Arquivo:

```txt
src/app/layouts/AdminLayout.tsx
```

O layout atual possui:

- Sidebar fixa no desktop.
- Menu lateral responsivo no mobile.
- Header com ambiente administrativo.
- Exibição do usuário logado.
- Botão de logout.
- Menu filtrado por roles.

Itens atuais do menu:

```txt
Dashboard
Empresas
Usuários
Permissões
```

Visibilidade por perfil:

```txt
Dashboard: SUPER_ADMIN, COMPANY_ADMIN, AREA_ADMIN, HEADQUARTER_USER, UNIT_USER
Empresas: SUPER_ADMIN
Usuários: SUPER_ADMIN, COMPANY_ADMIN
Permissões: SUPER_ADMIN, COMPANY_ADMIN
```

Observação: atualmente a proteção de rota é baseada em autenticação. A filtragem visual do menu usa roles, mas a autorização final ainda depende do backend retornar `403` quando o usuário não tiver permissão.

---

## 10. Componentes compartilhados já padronizados

### 10.1 `ActionsDropdown`

Arquivo:

```txt
src/shared/components/ActionsDropdown.tsx
```

Usado nas tabelas para ações como editar e inativar.

Características:

- Botão circular com ícone de três pontos.
- Menu renderizado via `createPortal` no `document.body`.
- `z-index` alto para sobrepor tabelas e cards.
- Fecha ao clicar fora.
- Fecha com tecla `Escape`.
- Recalcula posição em scroll e resize.
- Abre para cima quando não há espaço abaixo.
- Suporta itens com `onClick` ou `to`.
- Suporta variante `danger`.
- Suporta item desabilitado.

### 10.2 `SelectDropdown`

Arquivo:

```txt
src/shared/components/SelectDropdown.tsx
```

Criado para substituir `<select>` nativo e padronizar dropdowns internos do sistema.

Características:

- Visual alinhado ao design do Sicou.
- Menu renderizado via portal.
- Animação de abertura.
- Abre para cima quando está perto do rodapé.
- Suporta descrição por opção.
- Mostra opção selecionada com ícone de check.
- Suporta estado desabilitado.
- Usado atualmente nos campos de empresa e unidade dos modais de usuário.

---

## 11. Features implementadas

## 11.1 Auth

Status: **implementado**.

Funcionalidades:

- Login real.
- Persistência de sessão.
- Recuperação do usuário logado.
- Logout.
- Redirecionamento automático para login em sessão expirada.
- Separação correta entre `AuthProvider`, `AuthContext` e `useAuth`.

Endpoints consumidos:

```txt
POST /api/Auth/login
GET  /api/Auth/me
```

---

## 11.2 Empresas

Status: **CRUD visual completo**.

Arquivos principais:

```txt
src/features/companies/api/companiesApi.ts
src/features/companies/pages/CompaniesPage.tsx
src/features/companies/pages/CompanyDetailsPage.tsx
src/features/companies/components/CreateCompanyModal.tsx
src/features/companies/components/EditCompanyModal.tsx
src/features/companies/components/DeleteCompanyModal.tsx
src/features/companies/types/companyTypes.ts
```

Funcionalidades:

- Listar empresas.
- Criar empresa.
- Editar empresa.
- Inativar empresa.
- Abrir detalhes da empresa.
- Exibir status ativo/inativo.
- Exibir data de criação.
- Ações via `ActionsDropdown`.

Endpoints consumidos:

```txt
GET    /api/companies
GET    /api/companies/{id}
POST   /api/companies
PUT    /api/companies/{id}
DELETE /api/companies/{id}
```

Tipos principais:

```ts
Company
CreateCompanyRequest
UpdateCompanyRequest
```

---

## 11.3 Detalhes da empresa

Status: **implementado**.

Arquivo principal:

```txt
src/features/companies/pages/CompanyDetailsPage.tsx
```

A página de detalhes da empresa carrega a empresa selecionada e renderiza seções internas para:

```txt
Unidades
Áreas da sede
```

Essa página é acessada por:

```txt
/app/companies/:companyId
```

---

## 11.4 Unidades

Status: **CRUD visual completo dentro dos detalhes da empresa**.

Arquivos principais:

```txt
src/features/units/api/unitsApi.ts
src/features/units/components/CompanyUnitsSection.tsx
src/features/units/components/CreateUnitModal.tsx
src/features/units/components/EditUnitModal.tsx
src/features/units/components/DeleteUnitModal.tsx
src/features/units/types/unitTypes.ts
```

Funcionalidades:

- Listar unidades de uma empresa.
- Criar unidade vinculada à empresa.
- Editar unidade.
- Inativar unidade.
- Exibir cidade, estado, código e status.
- Ações via `ActionsDropdown`.

Endpoints consumidos:

```txt
GET    /api/companies/{companyId}/units
POST   /api/companies/{companyId}/units
PUT    /api/units/{unitId}
DELETE /api/units/{unitId}
```

Tipos principais:

```ts
Unit
CreateUnitRequest
UpdateUnitRequest
```

Observação: após inativar, a unidade pode sumir da listagem dependendo da regra atual do backend.

---

## 11.5 Áreas

Status: **CRUD visual completo dentro dos detalhes da empresa**.

Arquivos principais:

```txt
src/features/areas/api/areasApi.ts
src/features/areas/components/CompanyAreasSection.tsx
src/features/areas/components/CreateAreaModal.tsx
src/features/areas/components/EditAreaModal.tsx
src/features/areas/components/DeleteAreaModal.tsx
src/features/areas/types/areaTypes.ts
```

Funcionalidades:

- Listar áreas de uma empresa.
- Criar área vinculada à empresa.
- Selecionar módulos habilitados na criação.
- Editar dados da área.
- Editar módulos habilitados.
- Inativar área.
- Exibir slug, descrição, status e módulos.
- Ações via `ActionsDropdown`.

Endpoints consumidos:

```txt
GET    /api/companies/{companyId}/areas
POST   /api/companies/{companyId}/areas
PUT    /api/areas/{areaId}
PUT    /api/areas/{areaId}/modules
DELETE /api/areas/{areaId}
```

Módulos suportados:

```txt
Informatives
Guide
Workflows
```

Tipos principais:

```ts
AreaModuleCode
AreaModule
CompanyArea
CreateAreaRequest
UpdateAreaRequest
UpdateAreaModulesRequest
```

Observação importante: durante a integração, foi identificado e corrigido no backend um problema de concorrência no update dos módulos da área. O frontend atualmente já consegue adicionar e remover módulos sem erro.

---

## 11.6 Usuários

Status: **CRUD visual completo**.

Arquivos principais:

```txt
src/features/users/api/usersApi.ts
src/features/users/pages/UsersPage.tsx
src/features/users/components/CreateUserModal.tsx
src/features/users/components/EditUserModal.tsx
src/features/users/components/DeleteUserModal.tsx
src/features/users/types/userTypes.ts
```

Funcionalidades:

- Listar usuários.
- Criar usuário.
- Editar nome, e-mail, empresa, unidade, status e roles.
- Inativar usuário.
- Exibir status ativo/inativo.
- Exibir roles como badges.
- Ações via `ActionsDropdown`.
- Dropdowns de empresa e unidade usando `SelectDropdown`.

Endpoints consumidos:

```txt
GET    /api/users
POST   /api/users
PUT    /api/users/{userId}
PUT    /api/users/{userId}/roles
DELETE /api/users/{userId}
```

Tipos principais:

```ts
UserRole
User
CreateUserRequest
UpdateUserRequest
UpdateUserRolesRequest
```

Roles suportadas:

```txt
SUPER_ADMIN
COMPANY_ADMIN
AREA_ADMIN
HEADQUARTER_USER
UNIT_USER
```

Observação: a tabela de usuários atualmente exibe `companyId` e `unitId`, pois o response atual do backend fornece os identificadores. Uma melhoria futura recomendada é o backend retornar também `companyName` e `unitName`, ou o frontend montar um mapa auxiliar de empresas/unidades.

---

## 12. Dashboard atual

Arquivo:

```txt
src/app/pages/DashboardPage.tsx
```

Status: **placeholder funcional**.

O dashboard atual exibe:

- Card de empresas.
- Card de usuários.
- Card de permissões.
- Dados da sessão atual.

Ainda não possui métricas reais do backend.

---

## 13. Permissões granulares

Rota atual:

```txt
/app/access-control
```

Status: **placeholder**.

Essa será a próxima grande etapa do sistema.

O backend já possui endpoint planejado/implementado para acessos por área:

```txt
/api/user-area-accesses
```

A ideia da tela é permitir vincular usuários a áreas e definir permissões específicas por módulo e operação.

Permissões conceituais previstas no backend:

```txt
CanViewArea
CanManageArea
CanPublishInformative
CanManageGuide
CanManageWorkflow
CanHandleWorkflow
```

---

## 14. Padrões adotados no frontend

### 14.1 Organização por feature

Cada domínio deve concentrar seus próprios arquivos:

```txt
api
components
pages
types
index.ts
```

Exemplo:

```txt
src/features/users
├── api
├── components
├── pages
├── types
└── index.ts
```

### 14.2 API isolada por domínio

Cada feature possui seu arquivo de API:

```txt
companiesApi.ts
unitsApi.ts
areasApi.ts
usersApi.ts
authApi.ts
```

A regra é: componentes e páginas não chamam `fetch` diretamente. Toda chamada deve passar por uma função da feature, que por sua vez usa `apiFetch`.

### 14.3 Tipagem centralizada

Requests e responses usados pelo frontend ficam em `types` dentro da própria feature.

### 14.4 Componentes compartilhados

Componentes reutilizáveis devem ir para:

```txt
src/shared/components
```

Atualmente existem:

```txt
ActionsDropdown
SelectDropdown
```

### 14.5 Modais por operação

O padrão atual dos cadastros usa modais dedicados:

```txt
CreateXModal
EditXModal
DeleteXModal
```

### 14.6 Operações destrutivas como inativação

As ações `DELETE` estão sendo tratadas visualmente como **inativação**, mantendo o vocabulário do sistema alinhado à regra de negócio atual.

### 14.7 Evitar warnings do React Hooks

O projeto passou por ajustes para evitar warnings de lint relacionados a:

- Fast Refresh.
- `setState` dentro de effects de forma problemática.
- Dependências ausentes em hooks.

O padrão atual é manter funções dependentes memoizadas quando necessário, principalmente nos componentes de dropdown com listeners globais.

---

## 15. Integração com backend

O frontend está integrado com o backend local em:

```txt
http://localhost:5175
```

O backend esperado segue:

```txt
C#
.NET 8
ASP.NET Core Web API
PostgreSQL
Entity Framework Core
ASP.NET Core Identity
JWT Bearer
Repository Pattern
Service Layer
MVC via Controllers Web API
```

Principais contratos já consumidos:

```txt
/api/Auth/login
/api/Auth/me
/api/companies
/api/companies/{id}
/api/companies/{companyId}/units
/api/units/{id}
/api/companies/{companyId}/areas
/api/areas/{id}
/api/areas/{id}/modules
/api/users
/api/users/{id}
/api/users/{id}/roles
```

---

## 16. Estado atual do projeto

Resumo do que já está pronto:

```txt
Autenticação
- Login real
- Persistência de sessão
- Logout
- Proteção de rotas autenticadas

Layout
- Layout administrativo
- Sidebar responsiva
- Header com usuário logado
- Menu filtrado por roles

Empresas
- Listar
- Criar
- Editar
- Inativar
- Abrir detalhes

Unidades
- Listar por empresa
- Criar
- Editar
- Inativar

Áreas
- Listar por empresa
- Criar com módulos
- Editar dados
- Editar módulos
- Inativar

Usuários
- Listar
- Criar
- Editar dados, vínculos, status e roles
- Inativar

Componentes compartilhados
- ActionsDropdown
- SelectDropdown

Infra frontend
- apiFetch centralizado
- env centralizado
- constants de roles
- constants de storage
- utils com cn
```

---

## 17. Próximos passos recomendados

### Passo 1 — Controle de acessos granulares por área

Essa é a próxima etapa mais importante, pois fecha a base de governança do sistema.

Criar feature:

```txt
src/features/access-control
```

Estrutura sugerida:

```txt
src/features/access-control
├── api
│   ├── accessControlApi.ts
│   └── index.ts
├── components
│   ├── CreateUserAreaAccessModal.tsx
│   ├── EditUserAreaAccessModal.tsx
│   ├── DeleteUserAreaAccessModal.tsx
│   └── index.ts
├── pages
│   ├── AccessControlPage.tsx
│   └── index.ts
├── types
│   ├── accessControlTypes.ts
│   └── index.ts
└── index.ts
```

Endpoints esperados:

```txt
POST   /api/user-area-accesses
GET    /api/user-area-accesses/{id}
GET    /api/user-area-accesses/by-user/{userId}
GET    /api/user-area-accesses/by-company/{companyId}
PUT    /api/user-area-accesses/{id}
DELETE /api/user-area-accesses/{id}
```

Tela sugerida:

```txt
/app/access-control
```

Fluxo sugerido:

1. Selecionar uma empresa.
2. Listar usuários da empresa.
3. Listar áreas da empresa.
4. Criar vínculo usuário-área.
5. Marcar permissões granulares.
6. Editar permissões existentes.
7. Inativar/remover vínculo.

Permissões sugeridas para interface:

```txt
Visualizar área
Gerenciar área
Publicar informativos
Gerenciar orientador
Gerenciar workflows
Tratar workflows
```

---

### Passo 2 — Melhorar tabela de usuários

Hoje a tabela mostra `companyId` e `unitId`.

Melhorias recomendadas:

1. Ajustar o backend para retornar `companyName` e `unitName` no `UserResponse`.
2. Atualizar o frontend para exibir nomes amigáveis.
3. Adicionar filtros por empresa, unidade, role e status.
4. Adicionar busca por nome/e-mail.

---

### Passo 3 — Dashboard com dados reais

O dashboard deve sair do estado de placeholder e passar a exibir métricas reais.

Sugestões de cards:

```txt
Total de empresas ativas
Total de unidades ativas
Total de áreas ativas
Total de usuários ativos
Usuários por role
Áreas com cada módulo habilitado
Últimos usuários cadastrados
Últimas empresas cadastradas
```

Pode ser feito de duas formas:

1. Criar endpoints específicos no backend para dashboard.
2. Consumir endpoints já existentes e calcular no frontend enquanto o volume de dados for pequeno.

A opção recomendada para evolução é criar endpoints próprios no backend.

---

### Passo 4 — Filtros, busca e paginação

As listagens atuais funcionam bem para a fase inicial, mas futuramente precisarão de:

```txt
Busca textual
Filtro por status
Filtro por empresa
Filtro por unidade
Filtro por role
Paginação
Ordenação
```

Essa melhoria deve ser alinhada com o backend para evitar carregar grandes volumes de dados no frontend.

---

### Passo 5 — Guardas por role no frontend

Hoje o menu é filtrado por role e o backend garante a autorização real.

Melhoria recomendada:

- Criar um componente ou configuração de rota para impedir acesso visual a páginas sem role permitida.
- Exibir uma página `403` amigável quando o usuário tentar acessar rota não permitida.

---

### Passo 6 — Padronizar formulários

Os formulários atuais estão funcionais e tipados, mas podem evoluir para reduzir repetição.

Sugestões:

```txt
Input compartilhado
Textarea compartilhado
CheckboxCard compartilhado
StatusBadge compartilhado
RoleBadge compartilhado
ModalBase compartilhado
ConfirmModal compartilhado
```

Não é obrigatório agora, mas será útil antes dos módulos maiores.

---

### Passo 7 — Módulo Informativos

Após controle de acesso granular, o primeiro módulo de negócio pode ser o de Informativos.

Ideia inicial:

```txt
Área publica informativos
Unidades visualizam informativos
Permissão CanPublishInformative controla publicação
Permissão CanViewArea controla visualização
```

Possíveis telas:

```txt
/app/informatives
/app/areas/:areaId/informatives
```

---

### Passo 8 — Módulo Orientador

Depois dos informativos, implementar o Orientador como base de conhecimento operacional.

Ideia inicial:

```txt
Categorias de orientação
Artigos ou instruções
Vinculação com áreas
Permissão CanManageGuide para gestão
Visualização para unidades autorizadas
```

---

### Passo 9 — Módulo Workflows

O módulo de workflows deve ser implementado depois que usuários, áreas e permissões estiverem sólidos.

Ideia inicial:

```txt
Unidade abre solicitação
Área da sede recebe solicitação
Usuários autorizados tratam workflow
Status de andamento
Histórico de movimentações
Comentários
Anexos futuramente
```

Permissões relacionadas:

```txt
CanManageWorkflow
CanHandleWorkflow
```

---

## 18. Observações técnicas importantes

- O projeto usa React Router 7 importando de `react-router`.
- O Tailwind está configurado via plugin `@tailwindcss/vite`.
- O CSS global está em `src/index.css`.
- O projeto ainda possui assets padrões do Vite/React, como `react.svg` e `vite.svg`; eles podem ser removidos quando não forem mais usados.
- O zip analisado continha `node_modules`, mas normalmente essa pasta não deve ser versionada no repositório.
- O README padrão do Vite foi substituído por este documento de contexto real do projeto.

---

## 19. Checklist para continuar em um novo chat

Ao iniciar uma nova sessão de desenvolvimento, informar que:

```txt
O frontend do Sicou está em React + TypeScript + Vite + Tailwind.
A autenticação JWT já está funcionando.
Empresas, unidades, áreas e usuários já têm CRUD visual integrado ao backend.
ActionsDropdown e SelectDropdown já foram padronizados.
A próxima etapa é criar a tela real de controle de acessos granulares em /app/access-control.
O backend expõe /api/user-area-accesses para essa etapa.
```

Arquivos mais importantes para começar a próxima etapa:

```txt
src/app/router/AppRouter.tsx
src/app/layouts/AdminLayout.tsx
src/shared/api/apiFetch.ts
src/shared/components/ActionsDropdown.tsx
src/shared/components/SelectDropdown.tsx
src/features/users
src/features/companies
src/features/areas
```

---

## 20. Status final desta etapa

A fundação administrativa do frontend está pronta.

A aplicação já permite autenticar e gerenciar os principais cadastros estruturais do sistema:

```txt
Empresa
Unidade
Área
Usuário
Role
Módulos da área
```

A próxima etapa deve focar em transformar essa base estrutural em governança real, iniciando pela tela de **controle de acessos granulares por área**.
