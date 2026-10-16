# Pendências do Sicou

Atualizado em 16/10/2026, com base no **APÊNDICE C — Especificação dos Requisitos Funcionais e Não Funcionais** e no workspace atual.

Esta lista separa funcionalidades ausentes, complementos de funcionalidades existentes e critérios que precisam de comprovação. Os itens não representam o mesmo esforço. As alterações locais desta sessão não foram publicadas automaticamente na `main`.

## Registro obrigatório para atualizações com IA

Cada desenvolvedor que atualizar o projeto usando IA deve orientar a ferramenta a ler [README.md](README.md) e criar um registro em `_mds/ATUALIZACOES/`, seguindo [MODELO_ATUALIZACAO.md](MODELO_ATUALIZACAO.md). O registro deve informar **o que foi feito, as decisões tomadas, os motivos, as validações e as pendências**. Atualize esta lista quando uma pendência mudar de situação e vincule o registro correspondente.

A regra também está no [AGENTS.md da raiz](../AGENTS.md). Ferramentas sem suporte automático a esse arquivo precisam receber a orientação no contexto da tarefa.

## Mais simples para começar

- [ ] **RF-004 — Perfil Desenvolvedor:** definir permissões e criar o perfil, ou documentar sua equivalência com Super Admin conforme decisão da equipe.
- [x] **RF-029 — Filtro por período:** adicionar datas inicial/final nas consultas e na interface de processos ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [x] **RF-015 — Cancelamento de processos:** implementar estado e ação de cancelamento administrativo, autorização restrita ao criador ou administradores da área, histórico de auditoria com justificativa obrigatória e bloqueio de tramitações posteriores ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [ ] **RF-010 — Transferência de usuários:** complementar a troca de unidade com revogação/recomposição dos acessos antigos e registro da transferência. Validar que a autoria de processos antigos não mantenha acesso operacional indevido.
- [ ] **SMTP real:** preparação para Gmail entregue; remetente Gmail solicitado configurado em arquivo local ignorado e script de inicialização entregue; campos locais preenchidos e API reiniciada com SMTP; teste externo atingiu timeout. Falta validar conectividade SMTP, autenticação, entrega e redefinição. Para demonstração no mesmo computador, usar localhost. Consulte o [guia SMTP](SMTP.md) e o [registro de 15/10/2026](ATUALIZACOES/2026-10-15.md).
- [ ] **RNF-019 — Backup básico:** criar uma rotina agendada, definir retenção e validar uma restauração em ambiente separado. O volume Docker atual fornece persistência, mas não substitui backup.
- [ ] **RNF-001, RNF-002 e RNF-003 — Homologação inicial:** verificar os fluxos completos em Chrome, Firefox, Edge e Safari, em telas de computador, tablet e celular, e registrar a quantidade de interações.

**Ordem inicial sugerida:** perfil Desenvolvedor. A transferência de usuários exige atenção às regras de acesso; homologação pode revelar correções adicionais.

## Funcionalidades existentes que precisam de complemento

- [ ] **RF-008 / RNF-006 — Segregação por unidade:** garantir que todos os fluxos respeitem a unidade atual do usuário, inclusive após transferência e nas exceções por autoria.
- [ ] **RF-012 — Escalonamento para a sede:** definir critérios de encaminhamento por tipo de processo, criticidade, aprovação centralizada e solicitação manual autorizada.
- [ ] **RF-013 — Workflows completos:** incluir responsáveis por etapa e prazos. *(Atribuição de responsáveis por etapa/local de processo e bloqueio universal de manipulação entregues em [2026-10-14.md](ATUALIZACOES/2026-10-14.md); persistência de layout espacial, categorização por cores, exclusão de arestas e árvore homologada de Contratação RH entregues em [2026-10-15.md](ATUALIZACOES/2026-10-15.md); controle de prazos por etapa pendente).*
- [x] **RF-014 — Validação da execução:** validar campos obrigatórios, campos pertencentes à árvore/etapa, regras condicionais e transições no backend ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [x] **RF-015 — Estados de aprovação e rejeição:** operações e transições automáticas que atribuem estados terminais de aprovação (Approved), rejeição (Rejected) e finalização (Finished) ao atingir nós terminais, com apresentação destacada na interface e bloqueio de novas mutações ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [ ] **RF-016 / RNF-007 — Auditoria administrativa:** registrar alterações de usuários, setores, unidades e permissões com responsável, data/hora e dados relevantes da mudança.
- [ ] **RF-017 / RNF-018 — Notificações de pendências:** complementar os avisos de ações com aprovação direcionada ao responsável, vencimento e atraso. Depende de responsáveis, aprovação e controle de prazos.
- [x] **RF-028 — Aprovação efetiva:** configurar aprovadores/setores responsáveis e validar as decisões de aprovação e rejeição na API ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [ ] **RF-029 — Filtro por responsável:** atribuição com histórico e filtro entregues em Relatórios; falta levar o filtro à listagem operacional de processos. Consulte [contratos e limites](../backend/README.md#relatorios-e-documentos).

## Funcionalidades ainda ausentes

- [x] **RF-011 — Transferência de processos:** mover processos entre unidades e registrar unidade de origem, destino, responsável, data e horário ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [ ] **RF-018 — Dashboard gerencial:** apresentar indicadores reais de processos, unidades, prazos, status e desempenho operacional.
- [ ] **RF-024 — Monitoramento de automações:** implementar agente de comunicação e acompanhamento de execuções nos servidores locais.
- [ ] **RF-025 / RNF-017 — Logs de automações:** registrar status, data/hora, mensagens de erro e duração das execuções.
- [ ] **RF-026 — Alertas de automações:** detectar e avisar falhas, atrasos e interrupções.
- [ ] **RF-027 — Histórico de automações:** disponibilizar consulta das execuções para auditoria e acompanhamento.
- [ ] **RF-030 — Controle de prazos:** definir vencimentos de processos/etapas, identificar proximidade do vencimento e atraso e gerar os eventos de notificação.

## Correções técnicas relacionadas aos requisitos

- [ ] **RNF-005 / RNF-015 — Autorização:** conferir empresa, área, unidade e permissão antes de liberar operações de escrita em processos; revisar as liberações por cargo e autoria.
- [ ] **RNF-009 — Concorrência:** gerar números de processo de forma atômica e proteger a tramitação contra alterações simultâneas.
- [ ] **RNF-020 — Imagens do feed:** aplicar autorização ao acesso às imagens hoje servidas publicamente em `/uploads`.
- [ ] **RNF-004 / RNF-015 — Segurança de implantação:** configurar HTTPS e segredos próprios do ambiente produtivo e revisar contas de teste e políticas de sessão/acesso antes da implantação.

## Critérios que precisam de comprovação

- [ ] **RNF-001 — Navegadores:** registrar evidências de funcionamento em Chrome, Firefox, Edge e Safari.
- [ ] **RNF-002 — Responsividade:** validar os fluxos principais em computador, tablet e celular.
- [ ] **RNF-003 — Usabilidade:** verificar se abertura, consulta, aprovação e geração de relatório são concluídas em até cinco interações. Os fluxos de aprovação e relatório dependem das respectivas implementações.
- [ ] **RNF-010 — Desempenho:** medir e comprovar que 95% das requisições principais respondem em até dois segundos, sob condições de uso definidas.
- [ ] **RNF-011 — Disponibilidade:** implementar monitoramento e comprovar disponibilidade mínima de 99% de segunda a sexta-feira, das 8h às 18h.
- [ ] **RNF-019 — Restauração:** registrar evidência de recuperação dos dados a partir do backup.

## Entregas recentes já realizadas

- [x] **RF-019 — Relatórios:** `/app/reports` com processos, unidades, usuários e orientações, filtros próprios, seleção de colunas e paginação. Processos incluem período UTC, empresa, setor, unidade, status e responsável; atribuição com histórico. Diretórios de unidades/usuários são administrativos; orientações respeitam setores, módulo e publicação. [Tipos e contratos](README.md#tipos-de-relatorio).
- [x] **RF-020 — Exportação:** PDF, XLSX e CSV com os mesmos filtros e permissões da consulta. Limites explícitos: 1.000 processos em PDF, 5.000 em XLSX/CSV, sem truncamento silencioso.
- [x] **RF-022 / RNF-016 — Processamento de documentos:** extração de texto/tabelas de DOCX, XLSX, CSV e PDF; aplicação concreta em **Relatórios → Importar dados** para unidades, usuários e orientações por CSV/XLSX e workflows completos por JSON. Modelos, prévia com erros por linha, confirmação com permissões revalidadas e gravação transacional sem lotes parciais. Sem OCR, atualização em massa ou execução de macros/fórmulas. [Contratos, limites e validações](README.md#importacao-de-cadastros). Homologação visual de navegadores/dispositivos permanece pendente.
- [x] Recuperação por confirmação de e-mail, com link de uso único e validade de 30 minutos, validada por SMTP local (**RF-002**).
- [x] Recuperação administrativa com senha temporária, troca obrigatória e invalidação de sessões anteriores.
- [x] Notificações no sistema por empresa/área, com estado de leitura persistente.
- [x] Avisos detalhados do Orientador para criação, atualização, remoção, publicação e alterações de anexos.
- [x] Orientador com categorias, orientações, publicação/rascunho, busca, links e anexos autorizados.
- [x] Página dedicada de tramitação de processo com linha de vida, temporizador em tempo real, visualizador de dados do processo e regras/obrigatoriedade de parecer em nodos de análise ([14/10/2026](ATUALIZACOES/2026-10-14.md)).
- [x] Ciclo de vida e encerramento de processos com estados finais (Deferido, Indeferido, Concluído) e cancelamento administrativo com justificativa e bloqueio de tramitação ([15/10/2026](ATUALIZACOES/2026-10-15.md)).
- [x] Reformulação de UI/UX de árvores de decisão: página dedicada de detalhes (`/app/workflows/trees/:id`), histórico unificado de versões, ações rápidas, modais flutuantes centralizados e remoção total de drawers laterais ([15/10/2026](ATUALIZACOES/2026-10-15.md)).
- [x] Transferência de processos entre unidades com trilha de auditoria (`FromUnit` -> `ToUnit`), localizador avançado de processos com filtros combinados (código, unidade, status, solicitante e período de abertura), validação de campos obrigatórios por etapa na API/UI e provisionamento homologado da árvore "Contratação de Novo Colaborador" na área de Recursos Humanos ([15/10/2026](ATUALIZACOES/2026-10-15.md)).

Os avisos existentes ainda precisam dos complementos de prazo, aprovação e automações descritos acima. Os **51 testes HTTP aprovados** na sessão anterior validam cenários específicos de recuperação, notificações e Orientador; não certificam todos os requisitos do apêndice.

## Documentação relacionada

- [Recuperação de senha e notificações](../backend/RECUPERACAO_E_NOTIFICACOES.md)
- [Orientador](../backend/ORIENTADOR.md)
- [Atualizações de 09/10/2026](ATUALIZACOES/2026-10-09.md)
- [Atualizações de 14/10/2026](ATUALIZACOES/2026-10-14.md)
- [Atualizações de 15/10/2026](ATUALIZACOES/2026-10-15.md)

Responsáveis e datas de entrega devem ser definidos pela equipe. A consulta de 16/10/2026 identificou `origin/main` em `bf402ee`; suas alterações foram integradas ao workspace de `implementacao-do-orientador`, preservando os trabalhos locais. O merge ainda não foi commitado nem publicado. Consulte o [registro da integração](ATUALIZACOES/2026-10-16.md).

## Ambiente local — 15/10/2026

- [x] Inicializar frontend, API e banco local: frontend em localhost:5173, API em localhost:5175 e PostgreSQL local preexistente em 127.0.0.1:55439. Login, consulta autenticada, HTTP e CORS validados. Consulte o [registro](ATUALIZACOES/2026-10-15.md).

- [x] Ação **Resetar senha** na última coluna da lista de usuários, com array de elegibilidade da API e abertura da confirmação existente. Build de produção aprovado. [Registro de 15/10/2026](ATUALIZACOES/2026-10-15.md).

## Integração da main — 16/10/2026

- [x] Conciliar workflows, transferências e cancelamento da `main` com recuperação de senha, relatórios e importação da branch/local. Conflitos resolvidos, metadados das migrations conciliados e cancelamento incluído nos relatórios. Builds, testes e limites da validação descritos no [registro](ATUALIZACOES/2026-10-16.md).
- [ ] Versionar e publicar o merge quando solicitado pelo desenvolvedor. A integração permanece local, com backup e stash preservados; não representa publicação na `main` nem homologação visual dos requisitos.
