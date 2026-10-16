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
- [14/10/2026 — Página Isolada de Tramitação e Regras de Parecer](ATUALIZACOES/2026-10-14.md)
- [15/10/2026 — Workflows, transferências, acessos e SMTP](ATUALIZACOES/2026-10-15.md)
- [16/10/2026 — Integração da main com relatórios e importação locais](ATUALIZACOES/2026-10-16.md)

## Dados de demonstração local

O script [scratch/seed_large_demo.mjs](../scratch/seed_large_demo.mjs) popula somente o banco local `guide_test` em `127.0.0.1:55439`, com a API em `localhost:5175`. Execute da raiz: `node scratch/seed_large_demo.mjs`. Requer o PostgreSQL, a API e o acesso administrativo de demonstração já configurados localmente.

A população padrão contém 7.200 processos em três empresas e 12 setores, distribuídos pelos últimos 180 dias, com todos os status, responsáveis e solicitações sem responsável. Também prepara 15 unidades novas, 42 usuários, 24 tipos de processo homologados, 48 campos reutilizáveis e orientações para consulta. A empresa de demonstração original e seus logins continuam disponíveis; os gestores, analistas e usuários de unidade já existentes recebem acesso aos setores de teste da própria empresa.

Os processos usam o prefixo `DEMO26-`. Estados de aprovação, rejeição e conclusão e seus históricos são **sintéticos**, destinados a testar consulta, visualização e exportação; não representam operações reais nem homologação dos fluxos de decisão. Usuários são cadastrados pela API com o hash de senha da aplicação; a carga volumosa usa uma transação SQL e IDs determinísticos. Reexecutar preserva os registros existentes, sem duplicar os processos, campos ou históricos da carga. Não dispara e-mails.

As credenciais e a lista de novas contas ficam somente em `.cache/large-demo-credentials.json`, ignorado pelo Git. Não copie esse arquivo para a documentação ou para o versionamento. `SICOU_SEED_PER_AREA` permite ajustar a quantidade por setor (padrão 600, máximo 2.000); reexecutar com quantidade menor não remove registros já criados.

Para exercitar os limites de exportação, selecione um setor (aproximadamente 600 processos) para PDF; uma empresa tem 2.400 processos para XLSX/CSV. O recorte global ultrapassa os limites e deve pedir filtros adicionais. Esta massa não certifica desempenho ou autorização de todos os fluxos.

## Tipos de relatorio

Em `/app/reports`, as abas **Processos**, **Unidades**, **Usuários** e **Orientações** oferecem consulta paginada, seleção de colunas e downloads em PDF, XLSX e CSV. A aba **Importar dados** permite criar cadastros em lote. A exportação usa os filtros aplicados, não alterações ainda não enviadas do formulário, e inclui todas as páginas dentro do limite de 1.000 registros em PDF ou 5.000 em XLSX/CSV.

| Tipo | Dados e filtros |
| --- | --- |
| Unidades | Empresa, nome/código, cidade, UF, situação e criação UTC; quantidade de usuários ativos por unidade. Inclui unidades inativas quando não há filtro de situação. |
| Usuários | Nome/e-mail, empresa, unidade, perfil, situação e criação UTC. Inclui usuários inativos para consulta administrativa. Não retorna senha, hash, tokens ou dados de recuperação. |
| Orientações | Empresa, setor, categoria, busca em título/conteúdo, publicação e criação UTC. Colunas de título, categoria, setor, publicação, nome de anexo, link, resumo e datas. Resumo de até 500 caracteres; conteúdo binário dos anexos não é carregado nem exportado. |

Unidades e usuários exigem Super Admin ou Admin da Empresa. O administrador da empresa vê somente seus cadastros; o Super Admin também pode consultar usuários de plataforma sem empresa. Esses tipos não exigem existência de um setor de workflow.

Orientações usam autorização independente dos workflows: empresa e setor ativos, Orientador habilitado e vínculo de área correspondente à unidade atual. Leitores só recebem publicações; gestores do Orientador e administradores podem consultar rascunhos dentro do próprio escopo. Categorias sem itens visíveis não aparecem nas opções dos leitores. Consulta, opções e exportação mantêm essas regras no servidor.

### API dos relatórios de cadastros

- `GET /api/reports/catalog/options`: tipos autorizados e opções de empresas, unidades, setores e categorias.
- `GET /api/reports/catalog/{kind}`: `kind` é `units`, `users` ou `guides`; retorna `{ columns: [{ key, label, type }], items: [{ id, values }], total, page, pageSize }`.
- `GET /api/reports/catalog/{kind}/export/{format}`: `format` é `pdf`, `xlsx` ou `csv`; retorna download autenticado.

Filtros comuns: `companyId`, `search`, `startDate`, `endDate`, `page` (a partir de 1), `pageSize` (1 a 100; padrão 25). Datas em `AAAA-MM-DD`, com dia final inclusivo e horário UTC. Filtros adicionais: `unitId` e `status=active|inactive` para unidades/usuários; `role` para usuários; `city` e `state` para unidades; `areaId`, `categoryId` e `status=published|draft` para orientações. Filtros incompatíveis retornam 400; IDs de outra empresa/setor retornam 403. Leitor consultando rascunhos recebe conjunto vazio.

`columns` na exportação é uma lista de chaves da metadata, separadas por vírgula. Chaves desconhecidas são recusadas; a ordem é sempre a da tabela. CSV mantém neutralização de fórmulas; XLSX preserva datas e contagens numéricas. PDF adapta larguras às colunas e, quando houver caracteres ausentes na fonte, usa `?` com aviso no rodapé em vez de interromper a exportação.

Validação automatizada: `scratch/test_catalog_reports.mjs` exercita os novos tipos contra API isolada na porta 5185 e banco `reports_test_*`. `scratch/test_reports_documents.mjs` cobre a regressão de processos; testes unitários incluem exportação genérica e caracteres não suportados pelo PDF. A homologação visual da tela web e de todos os navegadores continua pendente.

## Importacao de cadastros

Em **Relatórios → Importar dados**, escolha o cadastro e a empresa de destino; para workflows e orientações, escolha também o setor. Baixe o modelo, preencha, envie para validação e confira a prévia antes de confirmar. Todos os registros devem estar válidos. A importação cria novos cadastros, preserva os existentes e não faz atualização ou exclusão em massa.

| Cadastro | Modelo | Resultado |
| --- | --- | --- |
| Unidades | CSV UTF-8 ou XLSX: `nome`, `codigo`, `cidade`, `uf` | Unidades ativas vinculadas à empresa. Nome e código obrigatórios e únicos; cidade e UF opcionais. |
| Usuários | CSV UTF-8 ou XLSX: `nome`, `email`, `perfil`, `unidade_codigo` | Contas ativas com perfil e vínculo de unidade. E-mail único; unidade ativa da empresa obrigatória para `UNIT_USER` e vazia para perfis da sede. |
| Orientações | CSV UTF-8 ou XLSX: `titulo`, `categoria`, `conteudo`, `url`, `publicar` | Itens do Orientador no setor; cria categorias ausentes. Título e categoria obrigatórios; `publicar=sim` publica, vazio ou `nao` cria rascunho. Links somente HTTP/HTTPS. Não importa anexos. |
| Workflows | JSON com a estrutura do modelo baixado | Tipos de processo em **rascunho**, com etapas, campos e transições vinculados. Revisão e homologação continuam no editor. |

Use exatamente as colunas do modelo, em qualquer ordem. Os arquivos têm limite de 2 MB; CSV/XLSX aceitam até 200 registros, uma planilha, sem macros ou fórmulas em células XLSX. Arquivos com cabeçalhos desconhecidos, fórmulas, linhas excedentes ou estrutura inválida são rejeitados; os dados não são cortados para caber numa prévia. Campos textuais vindos de CSV são tratados como texto.

Super Admin e Admin da Empresa importam unidades e usuários em seu escopo. Perfis aceitos: `AREA_ADMIN`, `HEADQUARTER_USER`, `UNIT_USER` e, somente para Super Admin, `COMPANY_ADMIN`. `SUPER_ADMIN` nunca pode ser concedido por importação. Cada conta recebe senha temporária aleatória individual, válida por 24 horas, com troca obrigatória no primeiro acesso. O administrador deve baixar os acessos imediatamente e entregá-los por canal privado; não são enviados e-mails nem armazenadas senhas em texto puro. Depois de sair da tela, use o reset de senha se precisar de novo acesso. Permissões de área precisam ser configuradas após a criação das contas.

Workflows e orientações exigem empresa/setor ativos, módulo habilitado e permissão administrativa ou de gestão do módulo no setor e unidade atuais. Leitores não importam. O servidor verifica novamente as permissões e referências ao confirmar.

### Estrutura dos workflows

O JSON contém `workflows`, com até 10 definições. Cada definição usa `codigo`, `nome`, `descricao`, `publico` (`Todos`, `Sede`, `Unidades`), `etapas`, `campos` e `transicoes`. O modelo disponível na tela já inclui um fluxo completo de três etapas.

- Etapas: `codigo`, `nome`, `tipo` (`inicio`, `etapa`, `aprovacao`, `fim`); 2 a 20 etapas, exatamente um início e um fim. Todas devem ser alcançáveis desde o início e permitir chegar ao fim; o fim não possui saída.
- Campos: `codigo`, `nome`, `tipo`, `etapa`, `obrigatorio`, `opcoes`; até 30 campos. `etapa` referencia o código local da etapa. Tipos seguem `FieldType`; anexos não são importados. `Select` e `MultiSelect` exigem opções.
- Transições: `origem`, `destino`, `permiteRetorno`; 1 a 50, com referências válidas e sem duplicação ou ligação da etapa para ela mesma.

Códigos têm até 20 letras/números/hífens/sublinhados e começam com letra ou número. Os códigos de etapas e campos são gravados como `CODIGO_WORKFLOW-CODIGO_LOCAL`, evitando colisões entre fluxos diferentes. A prévia mostra também público, descrição, obrigatoriedade, opções e retorno antes da confirmação.

### API e consistência

- `GET /api/imports/options`: tipos, empresas e setores autorizados.
- `GET /api/imports/{kind}/template/{format}`: modelos; `kind=units|users|guides` com `csv|xlsx`, ou `workflows` com `json`.
- `POST /api/imports/{kind}/preview`: multipart com `file`, `companyId` e, quando necessário, `areaId`; retorna linhas normalizadas, erros e avisos. Não grava cadastros. Somente um lote inteiramente válido recebe token opaco.
- `POST /api/imports/confirm`: JSON `{ "token": "..." }`; retorna tipo, quantidade criada e, apenas para usuários, acessos temporários. Respostas de prévia/confirmação usam `Cache-Control: no-store`.

O token pertence ao usuário que validou, expira em 10 minutos, é de uso único e fica em memória no servidor. Reiniciar a API invalida as prévias. Nova prévia válida substitui a anterior do mesmo usuário. Não há armazenamento permanente do arquivo. A confirmação revalida duplicidades e referências e grava o lote em uma transação; qualquer falha desfaz o lote inteiro. Um bloqueio transacional por empresa serializa confirmações de importações concorrentes. Depois de erro ou expiração, é necessário validar novamente. A implementação usa memória local e foi preparada para a instância única atual; múltiplas réplicas exigem armazenamento compartilhado das prévias.

A consulta original de texto/tabelas continua recolhida em **Consultar texto de um DOCX ou PDF**. Essa consulta é somente leitura e não transforma documentos arbitrários em cadastros.

Validação: `scratch/test_data_imports.mjs` usa somente o banco isolado `reports_test_*` e API na porta 5185. Verifica os quatro cadastros, permissões, senhas, referências, tokens de uso único, duplicidades antes/depois da prévia e rollback com falha real na segunda gravação. `ImportFileTests` cobre leitura sem truncamento, cabeçalhos estritos, limites, fórmulas e modelo de workflow. Homologação visual no navegador permanece pendente.
