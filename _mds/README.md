# Documentação e decisões do Sicou

Esta pasta centraliza as pendências e os registros das atualizações assistidas por IA, para que os próximos desenvolvedores entendam o estado do projeto e os motivos das decisões.

## Leitura inicial

- [Pendências por requisito e prioridade](PENDENCIAS.md)
- [Modelo de registro de atualização](MODELO_ATUALIZACAO.md)
- [Registros de atualizações](ATUALIZACOES/)
- [Backend](../backend/README.md)
- [Frontend](../frontend/README.md)
- [Orientador](../backend/ORIENTADOR.md)
- [Recuperação de senha e notificações](../backend/RECUPERACAO_E_NOTIFICACOES.md)

## Regra para atualizações usando IA

**Toda atualização do projeto realizada com assistência de IA deve ter um registro Markdown em `_mds/ATUALIZACOES/`, incluindo o que foi feito e as decisões tomadas com seus motivos.**

As IAs devem consultar esta documentação no início da tarefa e registrar a atualização antes de finalizar. A regra também está no [AGENTS.md da raiz](../AGENTS.md), para ferramentas que carregam esse arquivo automaticamente. Nas demais ferramentas, o desenvolvedor deve indicar a regra no contexto da tarefa.

Use `AAAA-MM-DD.md` e siga o modelo. Mantenha um arquivo por dia; acrescente novas seções com assunto e responsável para outras atualizações da mesma data. Preserve registros anteriores; quando uma decisão mudar, explique a nova decisão e referencie a anterior. Identifique correções factuais como correções.

Informe o responsável quando conhecido; caso contrário, escreva “não informado”. Registre somente validações executadas, distinguindo aprovações, falhas e verificações não realizadas. Nunca inclua credenciais ou segredos.

Ao concluir ou descobrir uma pendência, atualize `PENDENCIAS.md` e vincule o registro correspondente. Os registros devem acompanhar o código quando a equipe fizer commit/PR.

## Atualizações registradas

Os documentos dos módulos complementam os registros diários com detalhes de uso, configuração e contratos.

- [09/10/2026 — Recuperação, notificações e documentação](ATUALIZACOES/2026-10-09.md)
