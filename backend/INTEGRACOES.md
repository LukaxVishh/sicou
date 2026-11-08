# API de integração de Workflows

Permite que agentes (inclusive agentes de IA) e sistemas externos operem os **Workflows** do Sicou: listar workflows, abrir processos, consultar status, avançar ("passar para frente"), devolver, reiniciar, comentar, cancelar e transferir. Atende RF-021 e RF-023, UC-020 e RNF-014/RNF-015 do Apêndice C. Registro da implementação: [08/11/2026](../_mds/ATUALIZACOES/2026-11-08.md).

## Visão geral

| Item | Valor |
| --- | --- |
| Base das rotas | `/api/integrations/v1` |
| Autenticação | `Authorization: Bearer sic_...` (token de integração; o JWT de sessão é recusado com 401) |
| Swagger separado | UI em `/integrations/docs`, documento em `/swagger/integrations/swagger.json` |
| Swagger completo | `/swagger` (documentos `v1` e `integrations`), somente em Development |
| Gestão dos tokens | Tela **Integrações** (`/app/integrations`) e rotas `/api/integrations/*` com JWT de sessão |
| Limite | 120 chamadas/minuto por token e por instância da API (`Integrations:RequestsPerMinute`) |
| Auditoria | Tabela `integration_calls`, retenção de 90 dias (`Integrations:CallRetentionDays`, 7 a 3650) |

Em Development, os dois Swaggers ficam disponíveis. Fora dele, o Swagger completo fica desligado e o de integrações só é publicado com `Integrations:SwaggerEnabled=true`; nesse caso, `/swagger/v1/*` responde 404. Publicar o documento não libera operações: todas exigem token.

## Integrações

### Cadastro (UC-020)

Super Admin, Desenvolvedor e Admin da Empresa cadastram integrações na tela **Integrações**, informando somente o que o UC-020 pede: **nome, sistema externo e escopos de acesso**.

- **Empresa.** A integração pertence a uma empresa e só acessa dados dela. Para o Admin da Empresa, é sempre a própria empresa. Para Super Admin e Desenvolvedor, é a empresa escolhida no seletor corporativo do topo, enviada pela interface em `companyId`; sem empresa selecionada, o cadastro é recusado (400).
- **Sem usuário.** A integração não age em nome de nenhum usuário. O que ela pode fazer é definido pelos **escopos**, dentro da empresa: com `processes:move`, por exemplo, pode tramitar qualquer processo da empresa, em qualquer etapa. Processos e workflows de outra empresa respondem 404.
- **Autoria.** Nos processos, a integração aparece como autora, com `UserId` = `integration:{id}` e nome "Integração · {nome}". Isso vale para a abertura, o protocolo e cada registro do histórico. As notificações das ações de integração são geradas normalmente para os usuários elegíveis da empresa.
- **Gestão.** Admin da Empresa vê, renova e revoga as integrações da sua empresa. Super Admin e Desenvolvedor veem todas (com filtro opcional `companyId`). Usuários operacionais não gerenciam integrações (403). O token de integração não acessa as rotas de gestão nem as demais rotas da interface (401).

### Segredo, validade e renovação

- Formato: `sic_` + 32 bytes aleatórios em base64url (47 caracteres). É exibido **somente no cadastro e na renovação**, com `Cache-Control: no-store`.
- O banco guarda o SHA-256 hexadecimal (`TokenHash`, índice único) e um prefixo de 12 caracteres para identificação visual. O segredo não é armazenado.
- Validade fixa, definida no servidor: `Integrations:TokenLifetimeDays` (padrão 90; de 1 a 365). Não é um campo do formulário.
- **Renovação** (UC-020/E1, "o sistema externo deve renovar o token"): gera um novo segredo e uma nova validade para a mesma integração. O segredo anterior deixa de valer na hora. Integração revogada não pode ser renovada.
- No máximo 50 integrações ativas por empresa. Essa contagem não tem garantia transacional contra cadastros simultâneos.
- A cada chamada, o token é recusado com **401** quando está revogado, expirado ou substituído por renovação, ou quando a empresa está inativa.
- A listagem mostra o status `Active`, `Expired`, `Revoked` ou `Invalidated` (empresa inativa).

### Escopos

| Escopo | Libera |
| --- | --- |
| `workflows:read` | `GET /workflows`, `GET /workflows/{id}` |
| `processes:read` | `GET /processes`, `GET /processes/{id}`, `/status`, `/history` |
| `processes:create` | `POST /processes`, `PUT /processes/{id}/draft`, `POST /processes/{id}/submit` |
| `processes:move` | `POST /processes/{id}/advance`, `/return`, `/restart` |
| `processes:comment` | `POST /processes/{id}/comments` |
| `processes:cancel` | `POST /processes/{id}/cancel` |
| `processes:transfer` | `POST /processes/{id}/transfer` |

`GET /me` não exige escopo. Sem o escopo da rota, a resposta é **403** com `requiredScopes` (UC-020/E2).

### Rotas de gestão (JWT de sessão)

- `GET /api/integrations/scopes`: escopos e descrições.
- `GET /api/integrations/tokens?companyId=`: integrações visíveis, sem segredo nem hash.
- `POST /api/integrations/tokens`: `{ "name": "Robô de admissões", "externalSystem": "Agente de IA do RH", "scopes": ["workflows:read", "processes:read"] }`. Super Admin/Desenvolvedor enviam também `companyId`. Retorna 201 com `token`.
- `POST /api/integrations/tokens/{id}/renew`: novo segredo e nova validade; retorna 200 com `token`.
- `DELETE /api/integrations/tokens/{id}`: revoga na hora. Repetir a chamada mantém a revogação (204). Integração fora do escopo do administrador retorna 404.
- `GET /api/integrations/calls?tokenId=&page=1&pageSize=25`: log de auditoria paginado (1 a 100 por página), com `callsLast7Days` e `errorsLast7Days`.

## Rotas da API v1

Todas usam o prefixo `/api/integrations/v1` e retornam JSON. Os enums são serializados como texto (`InReview`, `EndApproved` etc.).

| Método e rota | Escopo | Finalidade |
| --- | --- | --- |
| `GET /me` | — | Integração autenticada: nome, sistema externo, empresa e escopos |
| `GET /workflows` | `workflows:read` | Workflows homologados e ativos da empresa |
| `GET /workflows/{id}` | `workflows:read` | Etapas, campos (com `code`) e transições |
| `GET /processes` | `processes:read` | Lista paginada. Filtros: `mine` (abertos por esta integração), `areaId`, `status`, `search`, `unitId`, `startDate`, `endDate`, `page`, `pageSize` (1 a 200) |
| `GET /processes/{id}` | `processes:read` | Processo completo, com campos e histórico |
| `GET /processes/{id}/status` | `processes:read` | Status resumido e próximos passos |
| `GET /processes/{id}/history` | `processes:read` | Histórico em ordem cronológica |
| `POST /processes` | `processes:create` | Abre o processo e, por padrão, protocola |
| `PUT /processes/{id}/draft` | `processes:create` | Atualiza um rascunho |
| `POST /processes/{id}/submit` | `processes:create` | Protocola um rascunho ou reenvia um processo devolvido |
| `POST /processes/{id}/advance` | `processes:move` | Avança para a próxima etapa |
| `POST /processes/{id}/return` | `processes:move` | Devolve para uma etapa anterior |
| `POST /processes/{id}/restart` | `processes:move` | Volta à etapa inicial |
| `POST /processes/{id}/comments` | `processes:comment` | Registra um parecer sem movimentar |
| `POST /processes/{id}/cancel` | `processes:cancel` | Cancelamento administrativo |
| `POST /processes/{id}/transfer` | `processes:transfer` | Transfere para outra unidade |

### Campos e etapas por código

Em `fields`, a chave pode ser o **código** do campo (sem diferenciar maiúsculas) ou o ID da definição. Os valores são gravados como texto, igual à interface web:

- números e booleanos viram texto (`1500` → `"1500"`, `true` → `"true"`);
- listas viram valores separados por vírgula (múltipla seleção);
- datas devem usar `AAAA-MM-DD`;
- objetos JSON são recusados.

Campos que não pertencem ao workflow geram 400, e a mensagem lista os códigos válidos. A etapa de destino pode ser informada por `targetNodeId` ou `targetNodeCode`; se os dois apontarem para etapas diferentes, a resposta é 400.

### Status para agentes

`GET /processes/{id}/status` devolve:

- `status` e `statusLabel` (ex.: "Em análise");
- `isTerminal`;
- `currentNode`: id, código, nome e tipo;
- unidades de origem e atual;
- `canManipulate`: processo em andamento e integração com `processes:move`;
- `pendingRequiredFields`: campos obrigatórios da etapa atual ainda vazios;
- `advanceTargets` e `returnTargets`;
- `availableActions`: subconjunto de `updateDraft`, `submit`, `advance`, `return`, `restart`, `comment`, `cancel` e `transfer`;
- `lastEvent`.

As ações são calculadas a partir do estado, da árvore e dos escopos e servem de **indicação**: o servidor revalida as regras do fluxo em toda operação. Um rascunho precisa ser protocolado (`submit`) antes de ser tramitado. Sem transição de retorno explícita, o destino de devolução é a etapa inicial, como no serviço existente.

### Exemplo de fluxo

```http
GET /api/integrations/v1/workflows
Authorization: Bearer sic_...

POST /api/integrations/v1/processes
Authorization: Bearer sic_...
Content-Type: application/json

{ "workflowId": "ID-DO-WORKFLOW", "title": "Admissão — Maria", "fields": { "NOME_CANDIDATO": "Maria", "CPF_CANDIDATO": "52998224725", "DATA_ADMISSAO": "2026-12-01" } }

GET /api/integrations/v1/processes/ID-DO-PROCESSO/status

POST /api/integrations/v1/processes/ID-DO-PROCESSO/advance
{ "targetNodeCode": "CODIGO-DA-ETAPA", "observations": "Documentos conferidos.", "fields": { "STATUS_DOCUMENTACAO": "Documentação Completa e Validada" } }

POST /api/integrations/v1/processes/ID-DO-PROCESSO/return
{ "observations": "Falta o comprovante de residência." }
```

Os códigos acima são ilustrativos; use os retornados por `GET /workflows/{id}`. `originUnitId` (opcional) indica a unidade de origem da empresa; vazio = sede. Workflows restritos a unidades exigem `originUnitId`, e os restritos à sede o recusam.

Com `submit=true` (padrão), `POST /processes` cria e protocola o processo **numa única gravação**. Se faltar um campo obrigatório da etapa inicial, nada é gravado e a resposta é 400. Com `submit=false`, cria um rascunho, que pode ser completado em `PUT /draft` e enviado em `POST /submit`.

## Erros

O corpo segue `{ "message": "...", "statusCode": 400 }`. Erros de validação de modelo usam `ValidationProblemDetails` (`errors`).

| HTTP | Situação |
| --- | --- |
| 400 | Dados inválidos, campo inexistente ou obrigatório ausente, transição não permitida, processo em estado terminal |
| 401 | Token ausente, inválido, expirado, revogado, substituído por renovação ou de empresa inativa; JWT de sessão enviado à API v1 (com `WWW-Authenticate`) |
| 403 | Escopo insuficiente (`requiredScopes`) |
| 404 | Workflow ou processo inexistente ou de outra empresa |
| 429 | Limite por minuto excedido (`Retry-After: 60`) |

As escritas **não são idempotentes**. Depois de um timeout, consulte `GET /processes?mine=true` ou `/status` antes de repetir, para não abrir ou movimentar o processo duas vezes.

## Auditoria e limites

Cada chamada autenticada por token grava em `integration_calls`:

- integração (token);
- método;
- template da rota (ex.: `api/integrations/v1/processes/{id:guid}/advance`);
- processo afetado, quando a rota é de processo;
- status HTTP final e duração.

Corpo, query string, cabeçalhos e credenciais não são gravados. A gravação ocorre no término da resposta, em escopo próprio: uma falha de auditoria vai para o log da API e não desfaz a operação. Também são registradas as respostas 403 de escopo. Chamadas com token inválido (401) e as bloqueadas pelo limite (429, que ocorre antes da autenticação) não são atribuídas a nenhum token. As ações de negócio continuam registradas no histórico do processo (`process_histories`) com a integração como autora.

O limite por minuto e a contagem ficam em memória, por instância. Várias réplicas ou um reinício não compartilham a contagem. O campo `LastUsedAt` é atualizado no máximo uma vez por minuto por token.

## Banco

A migration `20261108221743_AddIntegrationTokens` cria as duas tabelas. A API aplica as migrations ao iniciar; faça backup antes de atualizar um banco existente.

| Tabela | Campos e tipos | Regras e relações |
| --- | --- | --- |
| `integration_tokens` | `Id`, `CompanyId`, `CreatedByUserId`: uuid; `Name`, `ExternalSystem`: varchar(100); `TokenHash`: varchar(64); `TokenPrefix`: varchar(16); `Scopes`: varchar(500), separados por espaço; `CreatedAt`, `ExpiresAt`: data UTC; `RenewedAt`, `RevokedAt`, `LastUsedAt`: data UTC opcionais | PK `Id`; FK `CompanyId` → `companies` e FK `CreatedByUserId` → `users`, exclusão restrita; `TokenHash` único; índice `CompanyId`/`CreatedAt`. A integração não tem usuário. O segredo não é armazenado. |
| `integration_calls` | `Id`, `TokenId`: uuid; `ProcessInstanceId`: uuid opcional; `Method`: varchar(10); `Route`: varchar(300); `StatusCode`: integer; `DurationMs`: bigint; `CreatedAt`: data UTC | PK `Id`; FK `TokenId` → `integration_tokens`, exclusão restrita; índices `TokenId`/`CreatedAt` e `CreatedAt`. Rota gravada como template. `ProcessInstanceId` é vínculo lógico, sem FK. Retenção padrão de 90 dias. |

## Arquivos

- `src/Api/Controllers/IntegrationWorkflowsController.cs`: rotas v1.
- `src/Api/Controllers/IntegrationTokensController.cs`: gestão.
- `src/Api/Integrations/`:
  - autenticação (`IntegrationTokenAuthentication.cs`);
  - contratos (`IntegrationContracts.cs`);
  - tradução de códigos e cálculo do status (`IntegrationWorkflowMapper.cs`);
  - Swagger (`IntegrationSwagger.cs`);
  - auditoria e retenção (`IntegrationCallAudit.cs`).
- `src/Infrastructure/Services/IntegrationTokenService.cs`: cadastro, renovação, revogação, consulta e validação.
- `src/Infrastructure/Services/IntegrationProcessService.cs`: operações de Workflows da integração (isolamento por empresa, autoria e regras do fluxo reaproveitadas de `ProcessInstanceService`).
- `src/Domain/Constants/IntegrationScopes.cs`, `src/Domain/Entities/IntegrationToken.cs` e `src/Infrastructure/Data/IntegrationModelConfiguration.cs`.
- Frontend: `frontend/src/features/integrations/`.

## Validação

- `scratch/run_integration_workflows_test.sh`:
  - compila o backend no container `mcr.microsoft.com/dotnet/sdk:8.0`;
  - recria o banco descartável `sicou_integration_test` no container `sicou-postgres` (127.0.0.1:5434);
  - sobe a API na porta 5185, cria Super Admin e empresa e reinicia a API para o seeder do workflow de RH;
  - executa `scratch/test_integration_workflows.py`.
- O roteiro não toca em outros bancos e requer somente Podman e Python 3.
- Testes unitários: `tests/Sicou.UnitTests/IntegrationWorkflowTests.cs` (resolução de campos e etapas, conversão de valores, cálculo do status e geração/hash do segredo).
