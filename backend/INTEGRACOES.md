# API de integrações

## Disponibilidade

A tela **Integrações** (`/app/integrations`) permite criar tokens pessoais, escolher escopos, consultar chamadas e revogar acessos. Cada usuário vê somente seus próprios tokens e chamadas. O seletor corporativo do Super Admin não altera essa propriedade. Tokens de Super Admin mantêm o alcance global desse perfil; para automações de uma empresa, use uma conta vinculada a ela.

O Swagger de integrações está em `/swagger`, documento `/swagger/integrations/swagger.json`, com operações, schemas de entrada/saída e códigos de erro. Desenvolvimento também oferece o documento completo `v1`. Fora de Development, habilite explicitamente `Swagger__Enabled=true`; isso disponibiliza os documentos OpenAPI, mas as operações continuam autenticadas. A interface não memoriza tokens entre recargas. Use HTTPS na implantação.

No Swagger, o monitoramento de automações aparece no grupo **Workflows**, o termo da proposta, com resumo e descrição em cada operação. Só a apresentação mudou: rotas (`/api/automations/...`), escopos (`automations:read`/`automations:write`), contratos JSON e tabelas continuam com os nomes atuais, para que agentes e tokens já criados continuem funcionando. Não confundir com o módulo **Workflows e Processos** (árvores de tramitação, RF-013).

## Tokens e autenticação

Entre no sistema com sua conta e abra **Integrações**. Escolha nome, sistema externo, validade de 1 a 365 dias e pelo menos um escopo. O segredo `sic_...` aparece somente na criação: guarde-o no gerenciador de segredos da automação. A listagem nunca retorna o segredo ou seu hash. O banco guarda SHA-256 de 32 bytes aleatórios; não é um JWT de sessão.

Envie `Authorization: Bearer TOKEN`. No botão Authorize do Swagger, selecione IntegrationToken e cole apenas o segredo, sem `Bearer`.

O token não amplia acessos. A API carrega usuário e roles atuais em cada chamada e executa os mesmos serviços de autorização usados pelo sistema. Usuário inativo, bloqueado, com troca obrigatória de senha, mudança de security stamp (inclusive reset de senha), mudança de empresa/unidade, expiração ou revogação tornam o token inválido. Alterações de permissões têm efeito nas verificações atuais do sistema. As pendências anteriores de autorização em `_mds/PENDENCIAS.md` continuam aplicáveis; esta entrega não certifica todos os fluxos de escrita existentes.

Uma credencial de integração não pode gerir usuários, alterar configurações nem criar/revogar outros tokens. A lista de rotas é explícita e bloqueia novas rotas por padrão.

### Gestão, exclusivamente com JWT de sessão

- `GET /api/integrations/scopes`: lista de escopos aceitos.
- `POST /api/integrations/tokens`: `{ "name": "Financeiro", "externalSystem": "Robô financeiro", "expiresInDays": 30, "scopes": ["processes:read"] }`. Retorna 201 com `id`, `name`, `scopes`, `expiresAt` e `token` (uma vez). Até 20 tokens ativos por usuário; a verificação de quantidade não constitui garantia transacional contra criações concorrentes.
- `GET /api/integrations/tokens`: metadados próprios, incluindo `externalSystem`, com `scopes` separados por espaço, criação, expiração e revogação.
- `DELETE /api/integrations/tokens/{id}`: revoga imediatamente; repetir mantém a revogação. Outro proprietário recebe 404.
- `GET /api/integrations/calls?page=1&pageSize=25`: histórico próprio, `total`, indicadores `lastSevenDays.calls/errors` e `items`. Página começa em 1, tamanho de 1 a 100. Respostas de gestão usam `Cache-Control: no-store`.

## Operações disponíveis

| Escopo | Rotas |
| --- | --- |
| `documents:process` | `POST /api/documents/process` (multipart `file`, DOCX/XLSX/CSV/PDF, até 10 MB) |
| `imports:read` | `GET /api/imports/options`; `GET /api/imports/{kind}/template/{format}` |
| `imports:write` | `POST /api/imports/{kind}/preview`; `POST /api/imports/confirm` |
| `posts:create` | `POST /api/posts` |
| `processes:create` | `POST /api/processes` |
| `processes:write` | `PUT /api/processes/{id}/draft`; `POST /api/processes/{id}/protocol`; `POST /api/processes/{id}/advance` |
| `processes:cancel` | `POST /api/processes/{id}/cancel` |
| `processes:transfer` | `POST /api/processes/{id}/transfer` |
| `processes:read` | `GET /api/areas/{areaId}/processes`; `GET /api/processes/my`; `GET /api/processes/search`; `GET /api/processes/{id}`; `GET /api/process-types/available`; `GET /api/process-types/{id}`; `GET /api/users/me/process-nodes` |
| `reports:read` | `GET /api/reports/options`; `GET /api/reports/processes`; `GET /api/reports/processes/export/{format}` |
| `automations:read` | `GET /api/automations`; `GET /api/automations/{id}/runs` |
| `automations:write` | `POST /api/automations/{id}/runs`; `POST /api/automations/runs/{id}/heartbeat`; `POST /api/automations/runs/{id}/complete` |

Use `/api/areas/{areaId}/processes` para os dados da aba **Inbox** da área; `/api/processes/my` corresponde à aba **Minhas solicitações**, com processos do próprio solicitante. A apresentação e filtros locais da tela não são uma nova regra da API. Os filtros de busca existentes estão no Swagger.

### Chamadas de exemplo

Substitua os identificadores por IDs reais obtidos nas consultas. Os valores abaixo são ilustrativos.

```http
POST /api/processes
Authorization: Bearer TOKEN
Content-Type: application/json

{"processTypeId":"00000000-0000-0000-0000-000000000001","title":"Solicitação via automação","isDraft":true,"initialFieldValues":{}}
```

A criação retorna 201 com o processo. Para preencher rascunho, envie `fieldValues` (mapa de ID de campo para valor) em `PUT /api/processes/{id}/draft`. Para protocolar, envie `{ "fieldValues": {}, "observations": "Enviado pela integração" }` em `/protocol`. Nas etapas seguintes, `/advance` recebe `targetNodeId`, `observations` e `fieldValues`; obrigatoriedade, parecer, transições, responsáveis e estados terminais continuam validados pelos serviços existentes.

Cancelar usa `{ "reason": "Justificativa do cancelamento" }`. Transferir usa `{ "destinationUnitId": "ID-DA-UNIDADE", "observations": "Motivo da transferência" }`. Consulte schemas e regras do módulo Workflow para os demais campos.

Criar posts usa **multipart/form-data**, com `companyId`, `areaId` (opcional), `title`, `content` e `image` (opcional). Não envie JSON nessa rota.

Relatórios aceitam os filtros já existentes de empresa, área, unidade, período, status e responsável. A exportação aceita `pdf`, `xlsx` e `csv`, mantendo os limites de 1.000 registros em PDF e 5.000 em XLSX/CSV. Consulte o README de relatórios.

## Chamadas, limites e erros

Cada token reconhecido tem limite de **120 chamadas por minuto por instância da API**, com resposta 429 ao exceder. Não há fila. O limite é em memória: múltiplas réplicas e reinício não compartilham contagem. Não substitui controle de tráfego distribuído.

São registrados token/proprietário, horário UTC, método, template da rota, status final e duração até o término da resposta. Cabeçalhos, corpo, query string, IDs concretos da URL e conteúdo de erros não são persistidos. Tokens inválidos ou expirados não são identificados no histórico pessoal. Rotas proibidas e respostas 429 de tokens válidos são registradas. A persistência ocorre no término da resposta, em contexto separado; falha de auditoria é registrada no logger e não desfaz a operação de negócio. Desconexão/encerramento abrupto pode impedir o registro.

400 indica dados/filtros inválidos; 401, token inválido/expirado/revogado; 403, rota/escopo/permissão insuficiente; 404, recurso ausente; 429, limite de chamadas. Não repita automaticamente escritas de posts/processos após timeout: essas operações ainda não têm chave de idempotência. O monitoramento de execuções possui repetição segura descrita abaixo; 409 indica conflito de estado ou chave de execução.

O painel mostra totais e erros dos últimos sete dias e histórico paginado. Chamadas da API têm retenção automática de 90 dias, configurável por `Integrations__CallRetentionDays` (7 a 3650), com limpeza inicial e a cada hora. Execuções/alertas de automações possuem histórico separado, sem exclusão automática nesta versão. A gestão de tokens e o histórico de chamadas continuam pessoais; o monitoramento de execuções tem visão administrativa por empresa.

## Monitoramento de execuções

Em **Integrações → Execuções das automações**, cadastre uma rotina com nome, tempo máximo sem atividade (30 a 3600 segundos), duração esperada (1 a 1440 minutos; campo `maxRunMinutes` mantido por compatibilidade) e, opcionalmente, intervalo esperado de início (1 a 10080 minutos). O intervalo serve para detectar atrasos; não executa nem agenda a rotina. Um novo cadastro ou retomada começa a contar o intervalo a partir daquele momento. Alterações dos limites não modificam prazos das execuções já iniciadas.

O cadastro pertence ao usuário e ao vínculo empresa/unidade atual. Somente esse proprietário, com o mesmo vínculo, registra execuções ou altera a configuração. Outros usuários veem apenas suas automações. Admin da Empresa consulta histórico/indicadores e reconhece alertas da própria empresa; Super Admin consulta todos e pode filtrar `companyId`. O seletor corporativo limita a visualização do Super Admin. O dashboard recusa mais de 200 definições visíveis e pede recorte de empresa; não existe paginação do cadastro nesta versão.

### Contratos

- `POST /api/automations` (JWT de sessão): `{ "name": "Financeiro", "heartbeatTimeoutSeconds": 120, "maxRunMinutes": 60, "expectedIntervalMinutes": 1440 }`. Retorna 201 com o cadastro e seu ID; intervalo pode ser `null`.
- `PUT /api/automations/{id}` (JWT de sessão, proprietário): mesmas configurações e `isActive`. Pausar impede novos inícios e alertas de frequência; execuções já iniciadas continuam monitoradas. Histórico não é apagado.
- `GET /api/automations?companyId=...` (sessão ou `automations:read`): `automations`, `summary` (`running`, `succeeded`, `failed`, `unacknowledgedAlerts`) e os últimos 50 `alerts`. Sucessos e falhas/interrupções usam inícios dos últimos sete dias; execuções em andamento e alertas não reconhecidos são contados em todo o histórico visível.
- `GET /api/automations/{id}/runs?page=1&pageSize=25&status=Failed`: histórico paginado (até 100/página), `total` e `items`. Status: `Running`, `NoCommunication`, `Succeeded`, `Failed`, `Interrupted` (histórico legado). Resposta inclui `logs` e `durationAlertedAt`. Datas do servidor em UTC; `durationMs` é calculada do início ao término e fica `null` enquanto executa.
- `POST /api/automations/{id}/runs` (`automations:write` ou sessão do proprietário): `{ "externalId": "UUID-GERADO-PELO-CLIENTE", "host": "servidor-financeiro" }`. Retorna 201 na primeira gravação, 200 ao repetir a mesma chave e host, sempre com a mesma execução. Host tem até 100 caracteres. UUID vazio é inválido; reaproveitar chave com outro host retorna 409. Repetir chave após pausar devolve a execução existente, sem iniciar outra.
- `POST /api/automations/runs/{id}/heartbeat` (`automations:write`): sinal de atividade, sem corpo relevante. Atualiza `lastHeartbeatAt` e recupera `NoCommunication` para `Running`. Duração excedida não bloqueia atividade ou conclusão.
- `POST /api/automations/runs/{id}/complete` (`automations:write`): `{ "succeeded": false, "exitCode": 7, "message": "Comando terminou com código de erro." }`. `succeeded` deve ser explícito. Mensagem opcional tem até 2000 caracteres; `logs` opcional aceita até 16.000 caracteres; não envie dados pessoais, credenciais ou segredos. Sucesso com código diferente de zero é recusado. Repetir exatamente o resultado final é idempotente; mudar resultado/logs ou encerrar uma execução terminal retorna 409. `NoCommunication` permite conclusão posterior com o resultado real. Não há reinício de execuções terminais.
- `POST /api/automations/alerts/{id}/acknowledge` (JWT de sessão e visibilidade): marca leitura/reconhecimento, sem alterar resultado nem resolver a causa.

O monitor verifica a cada 30 segundos (configuração `Automations__ScanIntervalSeconds`, 1 a 300). Falta de heartbeat produz `NoCommunication`, sem `finishedAt`, e alerta próprio. O retorno de heartbeat recupera `Running`; conclusão posterior aceita o resultado real. Duração esperada excedida gera `DurationExceeded` uma vez por execução (`durationAlertedAt`), mantendo o comando e sua conclusão liberados. Conclusão com falha produz `Failed`. Registros legados `Interrupted` permanecem terminais e não são reescritos. Sem novo início no intervalo esperado gera alerta `Overdue`, uma vez por período de ausência; um novo início rearma a verificação. Nenhum alerta depende de abrir o dashboard.

O responsável operacional é o proprietário do cadastro. Alertas ficam no painel e geram notificação persistida para esse responsável na mesma transação. O alerta de falha (UC-021/E2) inclui o código de saída e a mensagem reportada pelo agente; mensagem do alerta e título da notificação são limitados a 250 caracteres. Administradores mantêm a consulta por empresa; não há redistribuição automática da responsabilidade. Reconhecer não apaga o histórico. A API serializa alterações por automação com locks de linha PostgreSQL; início concorrente com mesmo UUID não duplica execuções e workers concorrentes não duplicam a mesma interrupção/ausência. O monitor depende da API e do banco estarem disponíveis. Uma API parada detecta prazos vencidos ao retornar; não é um monitor externo de disponibilidade.

### Agente local

O arquivo [agents/sicou_agent.py](../agents/sicou_agent.py) usa somente Python 3.10+ e biblioteca padrão. Copie-o ao servidor da empresa e configure, por mecanismo seguro do ambiente, `SICOU_API_URL` (origem da API, sem `/api`), `SICOU_AUTOMATION_ID` e `SICOU_INTEGRATION_TOKEN` (escopo `automations:write`).

```sh
python3 sicou_agent.py -- python3 /opt/automacoes/financeiro.py
```

Agende esse comando no cron, serviço local ou Agendador de Tarefas. O Sicou não instala serviços remotamente e não envia comandos ao agente. HTTPS é obrigatório fora de localhost. O token é lido do ambiente e não precisa ser argumento de linha de comando.

O agente registra início antes de lançar o processo, envia heartbeat a cada 10 segundos e conclui com o código real de saída. Mantém a saída no terminal e transmite apenas os últimos 3.000 caracteres de cada fluxo stdout/stderr. Ao truncar, descarta a primeira linha parcial para não enviar um fragmento de segredo cortado na borda. Oculta o token e valores de ambiente com nomes de segredo, além de padrões Bearer/token/senha. Em falhas, inclui trecho do diagnóstico de stderr na mensagem. A filtragem não identifica todo dado pessoal ou segredo arbitrário; rotinas devem produzir logs apropriados. Use `--no-capture-output` antes de `--` para manter toda a saída somente local. Usa o mesmo UUID nas tentativas de início e o mesmo resultado nas tentativas de conclusão, com backoff para erros de rede, 429 e 5xx. A conclusão, por ser idempotente, tenta por cerca de um minuto (7 tentativas, espera máxima de 20 s) antes de desistir. Os trechos de saída são decodificados de forma incremental, preservando caracteres acentuados divididos entre leituras. Uma nova invocação local usa UUID novo; não existe deduplicação entre dois agendamentos que o operador execute separadamente.

Falha ao iniciar o executável é registrada como falha. SIGINT/SIGTERM encerra o processo e informa cancelamento local como `Failed`. Respostas de heartbeat 401/403/404/409 interrompem o processo local; o servidor preserva seu estado final ou detecta ausência de comunicação pelo timeout. No POSIX, encerra o grupo do processo; no Windows, encerra apenas o processo direto. Se a comunicação ficar indisponível, tenta reportar novamente; não há fila durável de eventos offline. SIGKILL/queda do servidor será identificado como sem comunicação pelo timeout no Sicou, e um comando local iniciado em grupo próprio pode continuar executando até ser encerrado pelo operador/serviço local.

Instalação em servidores reais, autenticação do ambiente, cadência de execução e homologação operacional precisam ser feitas pela equipe de cada empresa. Não foram executadas instalações ou alterações em servidores de terceiros nesta entrega.

### Regras de processos verificadas nesta etapa

Fluxos HTTP com token exercitam abertura, preenchimento, protocolo, inbox, transferência, relatório/exportação, avanço com campos obrigatórios, conclusão e cancelamento. Foram corrigidos acessos que permitiam a Admin da Empresa editar/protocolar processos de outra empresa, criação usando árvore/unidade de outra empresa e manutenção de poderes operacionais por autoria após transferência de unidade/empresa. Para Super Admin/Desenvolvedor, o processo sempre pertence à empresa da árvore selecionada.

A integração com a main atual preserva o acompanhamento somente de leitura dos próprios processos dentro da mesma empresa após troca de unidade (RF-010). A autoria deixa de conceder poderes operacionais depois da transferência; mudar de empresa também remove a consulta dos processos da empresa anterior. O perfil Desenvolvedor tem o mesmo alcance de plataforma do Super Admin, mantendo a exigência de propriedade para registrar execuções de automações.

Campos recebidos devem pertencer à árvore/etapa atual e estar ativos. Formulários podem reenviar valores históricos de outras etapas sem alterá-los; criar ou modificar esses valores é recusado. Esses testes cobrem cenários específicos e não substituem a homologação de todas as árvores/regras condicionais e dos requisitos completos de autorização.

## Banco, validação e continuidade

A migration `20261105233838_AddIntegrationTokens` cria tokens/chamadas; `20261106041126_AddAutomationMonitoring` cria automações, execuções e alertas. Ambas incluem índices e referências. A API aplica migrations ao iniciar, como já fazia. A implantação deve incluir os arquivos das migrations. Validação ocorreu somente em bancos descartáveis de teste.

`python3 scratch/test_integration_tokens.py` compila a API, cria PostgreSQL descartável via Docker, inicia API com configuração de teste, executa verificações HTTP e remove os processos/contêineres. Requer Docker e .NET 8; `SICOU_DOTNET` seleciona o executável. Não lê nem altera dados de uma instalação existente.

Próximas etapas: instalar/homologar o agente nos servidores das empresas, concluir a matriz de árvores/perfis, idempotência de escritas de negócio, rotação, política de retenção de execuções/alertas, limites distribuídos e filtros/paginação do cadastro. Os requisitos RF-024 a RF-027 têm implementação de agente/monitoramento nesta etapa; comprovação integral contra o Apêndice C e ambiente real continua pendente.


## Integração com ferramentas de documentos

Um cliente externo pode enviar arquivos diretamente ao Sicou com `documents:process`:

```sh
curl --fail-with-body -H "Authorization: Bearer $SICOU_INTEGRATION_TOKEN" \
  -F "file=@/caminho/documento.pdf" http://localhost:5175/api/documents/process
```

Resposta 200: `fileName`, `format`, `text`, `tables`, `warnings` e `pageCount`. Os formatos DOCX, XLSX, CSV e PDF foram exercitados por cliente HTTP com token. A extração é somente leitura, não armazena o arquivo nem faz OCR; mantém limites de texto, tabelas e capacidade do processador existente. O escopo não concede acesso a cadastros ou importações.

Para importar, use `imports:read` para opções/modelos e `imports:write` para prévia/confirmação. Prévia é multipart com `companyId`, `areaId` quando necessário e `file` (até 2 MB). Confirmação usa `{ "token": "TOKEN-DA-PREVIA" }`. O token da prévia não é a credencial de integração: é de uso único e vinculado ao usuário. Cadastros, formatos, permissões de empresa/setor, transação e validações permanecem os do [contrato de importação](../_mds/README.md#importacao-de-cadastros). Escopo não concede privilégios administrativos. Confirmar não deve ser repetido automaticamente após timeout; uma nova prévia é necessária se o resultado for desconhecido.

Novos escopos não são concedidos aos tokens antigos automaticamente. Crie outro token com os escopos necessários. `externalSystem` é obrigatório ao criar; na migration, tokens existentes recebem o nome anterior como identificação inicial, preservando hash, validade e revogação. Gestão e revogação continuam pessoais por JWT, conforme a decisão original de tokens pessoais; os perfis de administração mantêm seus poderes nos serviços de negócio. Não foi introduzido bloqueio de criação para usuários operacionais.

## Dicionário complementar ao Apêndice D — integrações e automações

Este complemento descreve as tabelas reais e pode ser incorporado ao documento acadêmico. Datas são UTC (`timestamp with time zone`). IDs são UUID. As tabelas de integrações/monitoramento são adicionais às tabelas gerais do Apêndice D recebido.

| Tabela | Campos e tipos | Regras e relações |
| --- | --- | --- |
| `integration_tokens` | `Id`, `UserId`: uuid; `CompanyId`, `UnitId`: uuid opcionais; `Name`, `ExternalSystem`: varchar(100); `TokenHash`: varchar(64); `SecurityStamp`: varchar(256); `Scopes`: varchar(500); `CreatedAt`, `ExpiresAt`: data UTC; `RevokedAt`: data UTC opcional | PK `Id`; FK `UserId` → `users`, exclusão restrita; hash único; índice por usuário/criação. Empresa/unidade são vínculo lógico revalidado, não FKs configuradas. Segredo não armazenado. |
| `integration_calls` | `Id`, `TokenId`, `UserId`: uuid; `Method`: varchar(10); `Route`: varchar(300); `StatusCode`: integer; `DurationMs`: bigint; `CreatedAt`: data UTC | PK `Id`; FK `TokenId` → `integration_tokens`, exclusão restrita; índices usuário/criação e token/criação. Rotas usam template; sem corpo, query ou credenciais. Retenção padrão 90 dias. |
| `automations` | `Id`, `UserId`: uuid; `CompanyId`, `UnitId`: uuid opcionais; `Name`: varchar(100); `IsActive`: boolean; `HeartbeatTimeoutSeconds`, `MaxRunMinutes`: integer; `ExpectedIntervalMinutes`: integer opcional; `CreatedAt`, `ScheduleBaselineAt`: data UTC; `LastStartedAt`, `OverdueAlertedAt`: data UTC opcionais | PK `Id`; FK `UserId` → `users`, exclusão restrita; índice empresa/usuário/criação. Proprietário e vínculo atuais obrigatórios para escrita. `MaxRunMinutes` é duração esperada, sem cancelamento automático. |
| `automation_runs` | `Id`, `AutomationId`, `ExternalId`: uuid; `Status`: varchar(20); `Host`: varchar(100); `StartedAt`, `LastHeartbeatAt`: data UTC; `FinishedAt`, `DurationAlertedAt`: data UTC opcionais; `ExitCode`: integer opcional; `Message`: varchar(2000) opcional; `Logs`: varchar(16000) opcional; `HeartbeatTimeoutSeconds`, `MaxRunMinutes`: integer | PK `Id`; FK `AutomationId` → `automations`, exclusão restrita; único automação/UUID externo; índices automação/início e status/heartbeat. `Running` e `NoCommunication` são abertos; `Succeeded`, `Failed` e legado `Interrupted` são terminais. Limites são copiados no início. Duração é derivada. |
| `automation_alerts` | `Id`, `AutomationId`: uuid; `RunId`: uuid opcional; `Kind`: varchar(20); `Message`: varchar(250); `CreatedAt`: data UTC; `AcknowledgedAt`: data UTC opcional | PK `Id`; FKs `AutomationId` → `automations` e `RunId` → `automation_runs`, exclusão restrita; índice automação/criação. Tipos atuais: `Failure`, `NoCommunication`, `DurationExceeded`, `Overdue`; legado `Interrupted` preservado. |

Alertas geram registros na tabela geral `user_notifications`, vinculados ao proprietário. Não há nova tabela de destinatários. Sem retenção automática de execuções/alertas; não existe exclusão de histórico nas operações do painel.

Migration `20261106172007_AlignAutomationMonitoringWithTcc`: adiciona `ExternalSystem`, `Logs` e `DurationAlertedAt`, com backfill do sistema externo pelo nome do token. Não altera resultados antigos. Faça backup e confira o banco antes de iniciar a API, que aplica migrations automaticamente.
