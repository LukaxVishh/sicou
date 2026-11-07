# Relatório de implementação — Monitoramento de automações do Sicou

**Data:** 06/11/2026  
**Responsável identificado na sessão:** cesusieh  
**Branch:** `feat/integracoes-automacoes`  
**Situação:** implementação disponível para testes locais; correções de aderência ao TCC versionadas na branch e enviadas para revisão por pull request.

## 1. Objetivo e escopo

Foi implementada a estrutura para acompanhar automações executadas no computador ou servidor da unidade, com autenticação por token, registro de execuções, sinais de atividade, resultado, logs, histórico e alertas.

O trabalho atende ao objetivo de criar um módulo de monitoramento de automações em servidores locais, descrito no **TCC principal, páginas 11–13**, e usa Swagger para documentar e testar a comunicação, conforme as **páginas 21–22** do mesmo documento. [1]

Este relatório concentra-se no módulo de automações e na autenticação necessária para utilizá-lo. Processos, relatórios de negócio e processamento/importação de documentos também receberam integração, mas não são detalhados aqui.

A entrega é uma estrutura para conectar e monitorar rotinas. Scripts de negócio de cada empresa continuam sendo definidos e executados no ambiente local. O Sicou não envia comandos remotos nem agenda a execução dessas rotinas: o agendamento usa cron, Agendador de Tarefas ou serviço equivalente.

## 2. Documentos do TCC utilizados

| Documento | Trechos relacionados | Aplicação na implementação |
| --- | --- | --- |
| TCC principal [1] | Páginas 11–13: objetivos de integração e monitoramento local; páginas 21–22: Swagger/OpenAPI | Define o propósito do módulo e a documentação da comunicação HTTP |
| Apêndice B — Casos de Uso [2] | UC-020, página 10; UC-021, página 11 | Define cadastro de integração, credenciais, auditoria, execução local, histórico e tratamento de falhas, comunicação e atraso |
| Apêndice C — Requisitos [3] | RF-023/RF-024, página 10; RF-025/RF-026/RF-027, páginas 11–12 | Define autenticação, monitoramento, logs, alertas e consulta do histórico |
| Apêndice C — Requisitos [3] | RNF-014, página 19; RNF-015/RNF-017, páginas 20–21; RNF-018, página 21 | Orienta API documentada, segurança, auditoria e notificação ao responsável |
| Apêndice D — Dicionário de Dados [4] | Documento recebido, sem descrição das entidades de integrações/automações | Motivou o complemento das cinco tabelas implementadas |
| Parecer Técnico Acadêmico [5] | Item 06: delimitação de escopo e evidências de conclusão | Orienta distinguir implementação local, resultado esperado e homologação operacional ainda pendente |

## 3. O que foi implementado

### 3.1. Autenticação das integrações

O usuário pode criar tokens pessoais com nome, identificação do sistema externo, escopos, validade e revogação. O segredo é exibido somente na criação; o banco armazena seu hash.

Cada chamada revalida a credencial e os dados atuais do proprietário. Escopo não amplia os poderes do usuário: as regras de acesso continuam sendo aplicadas pelo servidor. As chamadas reconhecidas são registradas com método, rota, horário, resultado HTTP e duração, sem salvar corpo ou credenciais.

Para monitoramento, os escopos são `automations:read` e `automations:write`. A gestão dos tokens e do cadastro da automação exige sessão de usuário autenticada por JWT.

### 3.2. Cadastro e acompanhamento

Cada automação possui proprietário, vínculo com empresa/unidade, nome, situação ativa ou pausada, limite de ausência de atividade, duração esperada e intervalo esperado de início opcional.

O painel permite consultar indicadores, execuções, status, datas, duração, diagnóstico, logs e alertas. Há histórico paginado e filtro por status. O proprietário registra as execuções; administradores consultam os dados dentro de seu alcance autorizado.

### 3.3. Agente Python local

O agente `agents/sicou_agent.py` utiliza Python 3.10+ e biblioteca padrão. Ele registra o início, executa o comando configurado localmente, envia heartbeat a cada dez segundos e reporta o resultado com o código de saída.

O agente mantém stdout/stderr no terminal e pode enviar trechos finais de até 3.000 caracteres por fluxo. Em caso de falha, inclui diagnóstico de stderr na mensagem. O token e segredos conhecidos são ocultados antes do envio. Essa filtragem não identifica todo dado sensível arbitrário; as rotinas devem produzir logs apropriados. A opção `--no-capture-output` desativa o envio da saída.

Início e conclusão têm repetição idempotente: repetir a mesma operação com os mesmos dados não deve duplicar a execução nem alterar seu resultado terminal.

## 4. Correções realizadas após comparar com o TCC

| Ponto | Situação anterior | Comportamento implementado |
| --- | --- | --- |
| Duração excedida — UC-021/E3 | Tratava a demora como interrupção; o agente podia encerrar o comando | Gera alerta `DurationExceeded` uma vez e mantém execução, heartbeat e conclusão liberados |
| Ausência de sinal — UC-021/E1 | Misturava perda de comunicação e duração excedida no estado `Interrupted` | Usa `NoCommunication`, com alerta próprio; permite recuperação por heartbeat ou conclusão com resultado real |
| Falha e diagnóstico — UC-021/E2, RF-025 | Agente enviava mensagem genérica de erro | Envia diagnóstico e trechos limitados de logs, disponíveis no histórico |
| Alerta de falha — UC-021/E2, RNF-018 | Alerta e notificação diziam apenas "Execução terminou com falha." | Incluem código de saída e mensagem reportada, limitados a 250 caracteres |
| Logs do agente — RF-025 | Caracteres acentuados divididos entre leituras viravam `�`; conclusão desistia após ~7 s | Decodificação incremental; conclusão idempotente repetida por ~1 min |
| Identificação da integração — UC-020 | Cadastro tinha nome e escopos | Inclui sistema externo obrigatório para novos tokens; preserva tokens antigos por preenchimento inicial a partir do nome |
| Rastreabilidade do modelo | Apêndice D não descrevia o módulo | Dicionário complementar entregue no guia técnico e em Markdown junto aos documentos locais do TCC |

Registros antigos com status `Interrupted` foram preservados. O novo comportamento não reescreve resultados históricos.

## 5. Rotas de automação disponíveis

O **Swagger de Integrações** apresenta estas cinco operações, autorizadas com o token de integração:

| Método e rota | Finalidade | Escopo |
| --- | --- | --- |
| `GET /api/automations` | Consultar automações, indicadores e alertas visíveis | `automations:read` |
| `GET /api/automations/{id}/runs` | Consultar histórico, resultados e logs da automação | `automations:read` |
| `POST /api/automations/{id}/runs` | Registrar início de execução, com UUID externo e servidor | `automations:write` |
| `POST /api/automations/runs/{id}/heartbeat` | Informar atividade e recuperar a comunicação | `automations:write` |
| `POST /api/automations/runs/{id}/complete` | Registrar sucesso/falha, código de saída, mensagem e logs | `automations:write` |

Nas rotas `/automations/{id}/runs`, o identificador é o da automação. Nas rotas `/automations/runs/{id}/...`, é o da execução retornada no início.

Há outras três operações na **API completa**, usadas pela tela de gestão e autenticadas com JWT de sessão:

| Método e rota | Finalidade |
| --- | --- |
| `POST /api/automations` | Cadastrar uma automação |
| `PUT /api/automations/{id}` | Atualizar configuração ou pausar/retomar |
| `POST /api/automations/alerts/{id}/acknowledge` | Registrar o reconhecimento de um alerta |

As três operações de gestão não aparecem no documento separado de integrações. Iniciar uma execução pela API registra seu acompanhamento; o comando é lançado pelo agente local.

## 6. Resultado esperado

Após cadastrar a automação e configurar o agente com um token válido, o comportamento esperado é:

| Cenário | Resultado esperado no Sicou |
| --- | --- |
| Rotina inicia | Uma execução é registrada como `Running`, com servidor e horário de início |
| Rotina continua ativa | Heartbeats atualizam a última atividade; o painel apresenta a execução em andamento |
| Rotina termina com código zero | Estado `Succeeded`, com término, duração, código e logs disponíveis |
| Rotina termina com erro | Estado `Failed`, com código, diagnóstico e logs; alerta e notificação ao proprietário responsável |
| Agente deixa de enviar atividade | Estado `NoCommunication` e alerta próprio, sem inventar resultado final para o comando |
| Agente retorna após a perda de sinal | Novo heartbeat recupera `Running`; a conclusão pode registrar o resultado real |
| Rotina ultrapassa a duração esperada | Um alerta de atraso é criado; a rotina continua e pode concluir normalmente |
| Nenhum novo início ocorre no intervalo configurado | Alerta `Overdue`, sem execução ou agendamento remoto da rotina |
| Mesma chave de início é repetida | A execução existente é retornada, sem duplicação; chave com outro servidor gera conflito |
| Conclusão idêntica é repetida | Mesmo resultado é retornado; mudar um resultado já encerrado é recusado |
| Usuário consulta histórico | Recebe execuções e logs permitidos pelo seu vínculo/perfil, com paginação e filtro |

Alertas por ausência ou atraso são verificados pelo monitor da API, com ciclo padrão de 30 segundos, e não dependem de o painel estar aberto. A notificação de falha é persistida ao concluir a execução com erro. O responsável operacional definido nesta versão é o proprietário do cadastro.

## 7. Validações executadas

| Verificação | Resultado e alcance |
| --- | --- |
| Suíte HTTP contra API real e PostgreSQL descartável | **163 verificações aprovadas** (157 anteriores + 6 de regressão desta revisão), abrangendo integrações, automações, processos e documentos; não são 157 testes exclusivos do módulo de automações |
| Testes unitários | **23 aprovados** na suíte existente |
| Backend e frontend | Builds aprovados; verificador do bundle de produção aprovado |
| Qualidade dos componentes de Integrações | ESLint aprovado nos componentes examinados |
| Interface em Chromium/Playwright | Aprovada com API simulada e perfil Desenvolvedor: sistema externo, tokens, cadastro, estado sem comunicação, atraso, logs, alertas, pausa e largura móvel |
| Modelo de banco | EF sem diferenças pendentes entre modelo e snapshot após gerar a migration |
| Teste de duração com agente real | Comando de 11 segundos continuou, enviou heartbeat e concluiu após alerta; o início foi antecipado no banco de teste para simular o limite, sem aguardar minutos |
| Ambiente local atualizado | Um sucesso e uma falha simulada com código 2, ambos com logs conferidos no histórico |

A suíte HTTP também verificou recuperação de comunicação, alerta único por duração, ocultação do token nos dados enviados, limite de logs, opção de não capturar saída, idempotência e preservação do histórico após reiniciar a API.

Os avisos preexistentes de nullable no backend e tamanho do pacote do frontend permanecem. O roteiro de teste pelo Swagger foi preparado; não há registro de conclusão manual pelo desenvolvedor nesta etapa.

## 8. Banco, ambiente e situação da entrega

A migration `20261106172007_AlignAutomationMonitoringWithTcc` adicionou a identificação do sistema externo nos tokens, os logs das execuções e a data do alerta de duração. Antes de aplicá-la, foi conferido o banco local de destino e criado backup com checksum e leitura do índice do arquivo. Não foi executada uma nova restauração completa desse backup.

Os registros anteriores foram preservados. O ambiente usa contêineres e volumes próprios, com frontend em `http://localhost:5173` e Swagger em `http://localhost:5175/swagger`. Nenhuma instalação foi realizada em servidor externo.

O histórico de implementação foi importado e publicado na branch de trabalho. As correções descritas neste relatório foram versionadas sobre `23f2d9852e23d5ceb98f3f2f34f39e9fb4791b76` e enviadas para revisão por pull request contra a `main`, que não foi alterada diretamente.

## 9. Pendências e limites

O monitoramento está implementado e validado no recorte local. Ainda é necessário instalar e homologar o agente no servidor real da unidade, testar as rotinas de negócio e confirmar limites, logs e responsáveis no uso operacional.

Não há fila offline durável, retenção automática de execuções/alertas ou encerramento administrativo específico para execuções que permaneçam sem comunicação. A filtragem dos logs não substitui o tratamento de dados sensíveis pela rotina. A auditoria das chamadas HTTP ocorre após a resposta e não possui garantia transacional completa.

O complemento do dicionário de dados precisa ser incorporado ao PDF acadêmico final. Os testes realizados não comprovam disponibilidade em produção, ganhos de produtividade ou homologação em todos os navegadores e ambientes.

## Referências

[1] [SICOU — TCC principal](<../Docs - TCC/SICOU_TCC_principal.pdf>), páginas 11–13 e 21–22.  
[2] [Apêndice B — Casos de Uso](<../Docs - TCC/APENDICE_B_Casos_de_Uso.pdf>), UC-020/UC-021, páginas 10–11.  
[3] [Apêndice C — Requisitos](<../Docs - TCC/APENDICE_C_Requisitos.pdf>), páginas 10–12 e 19–21.  
[4] [Apêndice D — Dicionário de Dados](<../Docs - TCC/APENDICE_D_Dicionario_de_Dados.pdf>) e [complemento de integrações/automações](<../Docs - TCC/COMPLEMENTO_APENDICE_D_INTEGRACOES_AUTOMACOES.md>).  
[5] [Parecer Técnico Acadêmico SICOU Detalhado](<../Docs - TCC/Parecer_Tecnico_Academico_SICOU_Detalhado.docx>), item 06.  
[6] [Guia técnico de integrações e dicionário complementar](backend/INTEGRACOES.md).  
[7] [Guia do agente local](agents/README.md).  
[8] [Registro de implementação de 06/11/2026](_mds/ATUALIZACOES/2026-11-06.md) e [pendências](_mds/PENDENCIAS.md).
