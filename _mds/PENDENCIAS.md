# Pendências do Sicou

Atualizado em 05/11/2026, com base no **APÊNDICE C — Especificação dos Requisitos Funcionais e Não Funcionais** e na conferência dos itens contra o código da `main` (`cef4710`), descrita no [registro de 05/11/2026](ATUALIZACOES/2026-11-05.md).

Esta lista separa funcionalidades ausentes, complementos de funcionalidades existentes e critérios que precisam de comprovação. Os itens não representam o mesmo esforço. As alterações locais desta sessão não foram publicadas automaticamente na `main`.

## Registro obrigatório para atualizações com IA

Cada desenvolvedor que atualizar o projeto usando IA deve orientar a ferramenta a ler [README.md](README.md) e criar um registro em `_mds/ATUALIZACOES/`, seguindo [MODELO_ATUALIZACAO.md](MODELO_ATUALIZACAO.md). O registro deve informar **o que foi feito, as decisões tomadas, os motivos, as validações e as pendências**. Atualize esta lista quando uma pendência mudar de situação e vincule o registro correspondente.

A regra também está no [AGENTS.md da raiz](../AGENTS.md). Ferramentas sem suporte automático a esse arquivo precisam receber a orientação no contexto da tarefa.

## Mais simples para começar

- [x] **RF-004 — Perfil Desenvolvedor:** perfil `DEVELOPER` criado com os mesmos poderes do Super Admin, conforme decisão da equipe; checagens de administrador da plataforma centralizadas no backend e no frontend; somente administradores da plataforma concedem o perfil ([05/11/2026](ATUALIZACOES/2026-11-05.md), [contrato](../backend/README.md#perfil-desenvolvedor-rf-004)). Homologação visual das telas não realizada.
- [x] **RF-029 — Filtro por período:** adicionar datas inicial/final nas consultas e na interface de processos ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [x] **RF-015 — Cancelamento de processos:** implementar estado e ação de cancelamento administrativo, autorização restrita ao criador ou administradores da área, histórico de auditoria com justificativa obrigatória e bloqueio de tramitações posteriores ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [x] **RF-010 — Transferência de usuários:** a troca de unidade ou empresa desativa os acessos da lotação anterior, permite ao administrador copiá-los para a nova unidade (mesma empresa), registra a transferência com origem, destino e responsável, invalida as sessões e exibe o histórico no detalhe do usuário. Nos processos, o vínculo exige empresa e unidade atuais, e a autoria de processos abertos antes da transferência dá apenas visualização ([05/11/2026](ATUALIZACOES/2026-11-05.md), [contrato](../backend/README.md#transferência-de-usuários-rf-010)). 26 verificações de ponta a ponta aprovadas em API isolada; homologação visual das telas não realizada.
- [ ] **SMTP real:** preparação para Gmail entregue; remetente Gmail solicitado configurado em arquivo local ignorado e script de inicialização entregue; campos locais preenchidos e API reiniciada com SMTP; teste externo atingiu timeout. *(Em 06/11/2026: as portas 587, 465 e 25 do `smtp.gmail.com` estão acessíveis e o STARTTLS funciona; a senha de aplicativo antiga era recusada (`535 5.7.8 BadCredentials`); com a nova senha gerada, o Gmail aceitou a autenticação e um envio de teste — [registro de 06/11/2026](ATUALIZACOES/2026-11-06.md).)* Falta confirmar o recebimento e validar o fluxo **Esqueci minha senha** com redefinição. Para demonstração no mesmo computador, usar localhost. O guia de configuração está no [registro de 06/11/2026](ATUALIZACOES/2026-11-06.md#guia-do-smtp-com-gmail); histórico no [registro de 15/10/2026](ATUALIZACOES/2026-10-15.md).
- [x] **RNF-019 — Backup básico:** serviço `backup` no Docker Compose com dump diário às 02:00 do banco e das imagens do feed, conferência de integridade, retenção de 14 dias com mínimo de 3 cópias e script de validação da restauração em PostgreSQL temporário e separado. Restauração validada com os dados do ambiente Docker ([05/11/2026](ATUALIZACOES/2026-11-05.md), com operação e limites no registro). As cópias ficam no mesmo computador.
- [x] **RNF-001, RNF-002 e RNF-003 — Homologação inicial:** marcada como concluída por declaração do desenvolvedor em 05/11/2026. Navegadores, dispositivos e quantidade de interações não foram anexados aos registros; as evidências continuam pendentes nos critérios de comprovação abaixo ([05/11/2026](ATUALIZACOES/2026-11-05.md)).

**Situação em 05/11/2026:** desta seção, resta apenas a validação do SMTP real.

## Funcionalidades existentes que precisam de complemento

- [ ] **RF-008 / RNF-006 — Segregação por unidade:** garantir que todos os fluxos respeitem a unidade atual do usuário, inclusive após transferência e nas exceções por autoria. *(Em 05/11/2026: Relatórios e, a partir do RF-010, o serviço de processos exigem o vínculo da unidade atual. Orientador, Feed e `PermissionService` ainda não comparam a unidade do vínculo; a transferência desativa os vínculos antigos, mas vínculos de transferências anteriores ao RF-010 podem continuar ativos.)*
- [ ] **RF-018 — Dashboard gerencial:** *reaberto em 05/11/2026.* O painel de 25/10 mostra apenas contagens de cadastro (empresas, usuários, unidades e áreas), sem indicadores de processos, prazos, status e desempenho — critério registrado em [16/10](ATUALIZACOES/2026-10-16.md) e [17/10](ATUALIZACOES/2026-10-17.md). As contagens também precisam de correção: as áreas vêm das opções do relatório de Orientações (somente setores com o Orientador ativo), e unidades e usuários incluem inativos, embora o texto fale em colaboradores ativos. Entrega parcial: [25/10/2026](ATUALIZACOES/2026-10-25.md); conferência: [05/11/2026](ATUALIZACOES/2026-11-05.md).
- [ ] **RF-012 — Escalonamento para a sede:** definir critérios de encaminhamento por tipo de processo, criticidade, aprovação centralizada e solicitação manual autorizada.
- [ ] **RF-013 — Workflows completos:** incluir responsáveis por etapa e prazos. *(Atribuição de responsáveis por etapa/local de processo e bloqueio universal de manipulação entregues em [2026-10-14.md](ATUALIZACOES/2026-10-14.md); persistência de layout espacial, categorização por cores e árvore homologada de Contratação RH entregues em [2026-10-15.md](ATUALIZACOES/2026-10-15.md); conexões anguladas ortogonais, indicador direcional de fluxo e gestão de exclusão por estado entregues em [2026-10-17.md](ATUALIZACOES/2026-10-17.md); controle de prazos por etapa pendente).*
- [x] **RF-014 — Validação da execução:** validar campos obrigatórios, campos pertencentes à árvore/etapa, regras condicionais e transições no backend ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [x] **RF-015 — Estados de aprovação e rejeição:** operações e transições automáticas que atribuem estados terminais de aprovação (Approved), rejeição (Rejected) e finalização (Finished) ao atingir nós terminais, com apresentação destacada na interface e bloqueio de novas mutações ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [ ] **RF-016 / RNF-007 — Auditoria administrativa:** registrar alterações de usuários, setores, unidades e permissões com responsável, data/hora e dados relevantes da mudança.
- [ ] **RF-017 / RNF-018 — Notificações de pendências:** complementar os avisos de ações com aprovação direcionada ao responsável, vencimento e atraso. Depende de responsáveis, aprovação e controle de prazos.
- [x] **RF-028 — Aprovação efetiva:** configurar aprovadores/setores responsáveis e validar as decisões de aprovação e rejeição na API ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [ ] **RF-029 — Filtro por responsável:** atribuição com histórico e filtro entregues em Relatórios; falta levar o filtro à listagem operacional de processos. Consulte [contratos e limites](../backend/README.md#relatorios-e-documentos).

## Funcionalidades ainda ausentes

- [x] **RF-011 — Transferência de processos:** mover processos entre unidades e registrar unidade de origem, destino, responsável, data e horário ([2026-10-15.md](ATUALIZACOES/2026-10-15.md)).
- [ ] **RF-024 — Monitoramento de automações:** implementar agente de comunicação e acompanhamento de execuções nos servidores locais.
- [ ] **RF-025 / RNF-017 — Logs de automações:** registrar status, data/hora, mensagens de erro e duração das execuções.
- [ ] **RF-026 — Alertas de automações:** detectar e avisar falhas, atrasos e interrupções.
- [ ] **RF-027 — Histórico de automações:** disponibilizar consulta das execuções para auditoria e acompanhamento.
- [ ] **RF-030 — Controle de prazos:** definir vencimentos de processos/etapas, identificar proximidade do vencimento e atraso e gerar os eventos de notificação.

## Correções técnicas relacionadas aos requisitos

- [ ] **RNF-005 / RNF-015 — Autorização:** conferir empresa, área, unidade e permissão antes de liberar operações de escrita em processos; revisar as liberações por cargo e autoria. *(Em 05/11/2026: a autoria passou a exigir a mesma empresa e ausência de transferência posterior à abertura, e o vínculo com setor passou a exigir empresa e unidade atuais. Falta revisar as demais liberações por cargo.)*
- [ ] **RNF-009 — Concorrência:** gerar números de processo de forma atômica e proteger a tramitação contra alterações simultâneas. *(Em 05/11/2026: o número ainda é calculado carregando todos os números da empresa e somando 1 ao maior, em memória; o índice único impede duplicidade, mas a colisão vira erro. A tramitação não tem controle de concorrência.)*
- [ ] **RNF-020 — Imagens do feed:** aplicar autorização ao acesso às imagens hoje servidas publicamente em `/uploads`.
- [ ] **RNF-004 / RNF-015 — Segurança de implantação:** configurar HTTPS e segredos próprios do ambiente produtivo e revisar contas de teste e políticas de sessão/acesso antes da implantação. *(Em 05/11/2026: o `docker-compose.yml` usa somente HTTP e senha fixa do banco, e a chave JWT está no `appsettings.json` versionado.)*

## Encontradas na conferência de 05/11/2026

Itens que existiam no código ou nos registros, mas não constavam nesta lista. Detalhes no [registro de 05/11/2026](ATUALIZACOES/2026-11-05.md).

- [ ] **Relatório de Tramitações e métricas de tramitação (commit `4bff707`):** o tipo `movements`, as colunas de tramitação dos processos (etapa e unidade atuais, dias, movimentações, caminhos, participantes e `formData`) e o filtro `movement` não têm registro em `ATUALIZACOES/`, documentação de contrato no [README](README.md#api-dos-relatórios-de-cadastros) nem testes. No tipo `movements`, o parâmetro `status` filtra o tipo de ação, e isso também precisa ser documentado.
- [ ] **Contexto de empresa no Dashboard e em Usuários:** se a aba guardar a empresa escolhida por um Super Admin, um Admin da Empresa que entrar depois vê as telas vazias, porque essas páginas priorizam `selectedCompanyId` e o logout não limpa `sicou_superadmin_selected_company` do `sessionStorage`. Não há vazamento de dados (o backend filtra pela empresa do usuário). Correção sugerida: usar o `activeCompanyId` do contexto e limpar a chave no logout.
- [ ] **Qualidade do frontend:** `npm run lint` acusa 99 erros e 7 avisos (principalmente `no-explicit-any` e `setState` em efeitos) e não faz parte do build; o pacote principal tem 1,56 MB, acima do aviso de 500 kB do Vite.

## Critérios que precisam de comprovação

- [ ] **RNF-001 — Navegadores:** registrar evidências de funcionamento em Chrome, Firefox, Edge e Safari.
- [ ] **RNF-002 — Responsividade:** validar os fluxos principais em computador, tablet e celular.
- [ ] **RNF-003 — Usabilidade:** verificar se abertura, consulta, aprovação e geração de relatório são concluídas em até cinco interações. Os fluxos de aprovação e relatório dependem das respectivas implementações.
- [ ] **RNF-010 — Desempenho:** medir e comprovar que 95% das requisições principais respondem em até dois segundos, sob condições de uso definidas.
- [ ] **RNF-011 — Disponibilidade:** implementar monitoramento e comprovar disponibilidade mínima de 99% de segunda a sexta-feira, das 8h às 18h.
- [x] **RNF-019 — Restauração:** backup do banco Docker `sicou-dev` restaurado em PostgreSQL temporário e separado, com hash conferido e contagens iguais às da origem nas 28 tabelas (7.200 processos, 19.192 históricos); arquivo das imagens com os mesmos 2 arquivos do volume ([05/11/2026](ATUALIZACOES/2026-11-05.md)). Repetir a validação periodicamente com `scripts/backup/restore-check.ps1`.
- [ ] Homologar visualmente a navegação em blocos animada do Orientador com dados reais ([27/10/2026](ATUALIZACOES/2026-10-27.md)).
- [ ] Validar a prévia de anexos do Orientador com XLSX e imagens reais, em Firefox e Safari e com perfil leitor ([28/10/2026](ATUALIZACOES/2026-10-28.md)).

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
- [x] Gestão de áreas da sede por Administrador de Empresa (criar, editar, inativar e atribuir módulos) e seletor corporativo no layout/sidebar para Super Admin com padrão em Visão Global ([25/10/2026](ATUALIZACOES/2026-10-25.md)).

Os avisos existentes ainda precisam dos complementos de prazo, aprovação e automações descritos acima. Os **51 testes HTTP aprovados** na sessão anterior validam cenários específicos de recuperação, notificações e Orientador; não certificam todos os requisitos do apêndice.

## Documentação relacionada

- [Recuperação de senha e notificações](../backend/RECUPERACAO_E_NOTIFICACOES.md)
- [Orientador](../backend/ORIENTADOR.md)
- [Atualizações de 09/10/2026](ATUALIZACOES/2026-10-09.md)
- [Atualizações de 14/10/2026](ATUALIZACOES/2026-10-14.md)
- [Atualizações de 15/10/2026](ATUALIZACOES/2026-10-15.md)
- [Atualizações de 16/10/2026](ATUALIZACOES/2026-10-16.md)
- [Atualizações de 17/10/2026](ATUALIZACOES/2026-10-17.md)
- [Atualizações de 25/10/2026](ATUALIZACOES/2026-10-25.md)
- [Atualizações de 27/10/2026](ATUALIZACOES/2026-10-27.md)
- [Atualizações de 28/10/2026](ATUALIZACOES/2026-10-28.md)
- [Conferência de 05/11/2026](ATUALIZACOES/2026-11-05.md)

Responsáveis e datas de entrega devem ser definidos pela equipe. Em 16/10/2026, a integração de `origin/main` (`bf402ee`) com `implementacao-do-orientador` e os trabalhos locais foi concluída no commit `7c60bd5`, enviado primeiro à branch e depois integrado e publicado na `main`, conforme autorização do desenvolvedor. Consulte o [registro da integração e publicação](ATUALIZACOES/2026-10-16.md).

## Ambiente local — 15/10/2026

- [x] Inicializar frontend, API e banco local: frontend em localhost:5173, API em localhost:5175 e PostgreSQL local preexistente em 127.0.0.1:55439. Login, consulta autenticada, HTTP e CORS validados. Consulte o [registro](ATUALIZACOES/2026-10-15.md).

- [x] Ação **Resetar senha** na última coluna da lista de usuários, com array de elegibilidade da API e abertura da confirmação existente. Build de produção aprovado. [Registro de 15/10/2026](ATUALIZACOES/2026-10-15.md).

## Integração da main — 16/10/2026

- [x] Conciliar workflows, transferências e cancelamento da `main` com recuperação de senha, relatórios e importação da branch/local. Conflitos resolvidos, metadados das migrations conciliados e cancelamento incluído nos relatórios. Builds, testes e limites da validação descritos no [registro](ATUALIZACOES/2026-10-16.md).
- [x] Versionar e publicar o merge: commit `7c60bd5` enviado para `implementacao-do-orientador` e integrado à `main` por fast-forward. Os dois hashes remotos foram conferidos após o push. Backup e stash preservados; homologação visual dos requisitos continua pendente. Consulte o [registro da publicação](ATUALIZACOES/2026-10-16.md).

## Conferência das pendências — 05/11/2026

- [x] Conferir os itens desta lista contra o código da `main` (`cef4710`): os itens abertos que podem ser verificados no código continuam pendentes; os concluídos conferidos existem; RF-018 foi reaberto; quatro itens novos foram incluídos. Backend não compilado nem testado nesta conferência. Consulte o [registro](ATUALIZACOES/2026-11-05.md).
