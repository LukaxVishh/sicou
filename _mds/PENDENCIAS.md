# Pendências do Sicou

Atualizado em 09/10/2026, com base no **APÊNDICE C — Especificação dos Requisitos Funcionais e Não Funcionais** e no workspace atual.

Esta lista separa funcionalidades ausentes, complementos de funcionalidades existentes e critérios que precisam de comprovação. Os itens não representam o mesmo esforço. As alterações locais desta sessão não foram publicadas automaticamente na `main`.

## Registro obrigatório para atualizações com IA

Cada desenvolvedor que atualizar o projeto usando IA deve orientar a ferramenta a ler [README.md](README.md) e criar um registro em `_mds/ATUALIZACOES/`, seguindo [MODELO_ATUALIZACAO.md](MODELO_ATUALIZACAO.md). O registro deve informar **o que foi feito, as decisões tomadas, os motivos, as validações e as pendências**. Atualize esta lista quando uma pendência mudar de situação e vincule o registro correspondente.

A regra também está no [AGENTS.md da raiz](../AGENTS.md). Ferramentas sem suporte automático a esse arquivo precisam receber a orientação no contexto da tarefa.

## Mais simples para começar

- [ ] **RF-004 — Perfil Desenvolvedor:** definir permissões e criar o perfil, ou documentar sua equivalência com Super Admin conforme decisão da equipe.
- [ ] **RF-029 — Filtro por período:** adicionar datas inicial/final nas consultas e na interface de processos.
- [ ] **RF-015 — Cancelamento de processos:** implementar estado e ação de cancelamento, autorização, histórico e tratamento das ações posteriores ao cancelamento.
- [ ] **RF-010 — Transferência de usuários:** complementar a troca de unidade com revogação/recomposição dos acessos antigos e registro da transferência. Validar que a autoria de processos antigos não mantenha acesso operacional indevido.
- [ ] **SMTP real:** configurar provedor, remetente, credenciais e origem HTTPS do frontend. A recuperação por e-mail já funciona na caixa local; esta tarefa depende das credenciais do provedor.
- [ ] **RNF-019 — Backup básico:** criar uma rotina agendada, definir retenção e validar uma restauração em ambiente separado. O volume Docker atual fornece persistência, mas não substitui backup.
- [ ] **RNF-001, RNF-002 e RNF-003 — Homologação inicial:** verificar os fluxos completos em Chrome, Firefox, Edge e Safari, em telas de computador, tablet e celular, e registrar a quantidade de interações.

**Ordem inicial sugerida:** perfil Desenvolvedor, filtro por período e cancelamento de processos. A transferência de usuários exige atenção às regras de acesso; homologação pode revelar correções adicionais.

## Funcionalidades existentes que precisam de complemento

- [ ] **RF-008 / RNF-006 — Segregação por unidade:** garantir que todos os fluxos respeitem a unidade atual do usuário, inclusive após transferência e nas exceções por autoria.
- [ ] **RF-012 — Escalonamento para a sede:** definir critérios de encaminhamento por tipo de processo, criticidade, aprovação centralizada e solicitação manual autorizada.
- [ ] **RF-013 — Workflows completos:** incluir responsáveis por etapa e prazos.
- [ ] **RF-014 — Validação da execução:** validar campos obrigatórios, campos pertencentes à árvore/etapa, regras condicionais e transições no backend.
- [ ] **RF-015 — Estados de aprovação e rejeição:** completar as operações que atribuem esses estados e sua apresentação na interface; a declaração dos estados no enum não implementa o fluxo.
- [ ] **RF-016 / RNF-007 — Auditoria administrativa:** registrar alterações de usuários, setores, unidades e permissões com responsável, data/hora e dados relevantes da mudança.
- [ ] **RF-017 / RNF-018 — Notificações de pendências:** complementar os avisos de ações com aprovação direcionada ao responsável, vencimento e atraso. Depende de responsáveis, aprovação e controle de prazos.
- [ ] **RF-028 — Aprovação efetiva:** configurar aprovadores/setores responsáveis e validar as decisões de aprovação e rejeição na API.
- [ ] **RF-029 — Filtro por responsável:** implementar a atribuição de responsáveis e acrescentar esse filtro às consultas e à interface.

## Funcionalidades ainda ausentes

- [ ] **RF-011 — Transferência de processos:** mover processos entre unidades e registrar unidade de origem, destino, responsável, data e horário.
- [ ] **RF-018 — Dashboard gerencial:** apresentar indicadores reais de processos, unidades, prazos, status e desempenho operacional.
- [ ] **RF-019 — Relatórios:** oferecer relatórios customizáveis com filtros por período, setor, unidade, status e responsável.
- [ ] **RF-020 — Exportação de relatórios:** exportar em PDF, XLSX e CSV. Depende da implementação dos relatórios.
- [ ] **RF-022 / RNF-016 — Processamento de documentos:** integrar ferramentas para processar DOCX, XLSX, CSV e PDF. O armazenamento e download de anexos do Orientador já existem.
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

- [x] Recuperação por confirmação de e-mail, com link de uso único e validade de 30 minutos, validada por SMTP local (**RF-002**).
- [x] Recuperação administrativa com senha temporária, troca obrigatória e invalidação de sessões anteriores.
- [x] Notificações no sistema por empresa/área, com estado de leitura persistente.
- [x] Avisos detalhados do Orientador para criação, atualização, remoção, publicação e alterações de anexos.
- [x] Orientador com categorias, orientações, publicação/rascunho, busca, links e anexos autorizados.

Os avisos existentes ainda precisam dos complementos de prazo, aprovação e automações descritos acima. Os **51 testes HTTP aprovados** nesta sessão validam cenários específicos de recuperação, notificações e Orientador; não certificam todos os requisitos do apêndice.

## Documentação relacionada

- [Recuperação de senha e notificações](../backend/RECUPERACAO_E_NOTIFICACOES.md)
- [Orientador](../backend/ORIENTADOR.md)
- [Atualizações de 09/10/2026](ATUALIZACOES/2026-10-09.md)

Responsáveis e datas de entrega devem ser definidos pela equipe. A inspeção das branches remotas não identificou commits pendentes de integração na `main`; trabalhos locais dos demais desenvolvedores podem não estar publicados.
