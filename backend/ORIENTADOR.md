# Módulo Orientador

Disponível em `/app/guide`, pelo menu **Orientador** da área quando o módulo está habilitado, e na aba **Orientador & Guias** da empresa. Na navegação por área, `/app/guide?areaId=UUID` restringe a consulta à área selecionada e autorizada.

## Uso

1. Habilite o módulo `Guide` na área.
2. Conceda `CanManageGuide` aos responsáveis e `CanView` aos leitores no cadastro de permissões. Administradores da empresa podem gerenciar suas áreas; Super Admin pode gerenciar todas.
3. Crie categorias e orientações. Cada orientação aceita título, instruções em texto, link HTTP/HTTPS, ordem e um anexo de até 10 MB.
4. Marque **Publicar para consulta** para disponibilizar a orientação. Rascunhos e seus anexos ficam visíveis apenas para gestores.
5. Use a busca e o filtro de categoria para consultar. A busca ignora acentos e inclui título, instruções, categoria e nome do anexo. Gestores também podem filtrar publicadas e rascunhos e publicar ou despublicar diretamente na lista. Use **Limpar filtros** para voltar à consulta completa. Uma categoria só pode ser excluída depois de remover ou mover seus itens.

Se o envio do anexo falhar após salvar uma orientação, ela permanece na lista e o formulário mantém seu identificador para tentar novamente sem duplicar o cadastro. Baixar anexos preserva a consulta atual sem recarregar a lista.

Categorias e itens são ordenados por ordem numérica, seguida de nome/título. Exclusões são permanentes e pedem confirmação na interface. O upload substitui o anexo atual. O conteúdo é renderizado como texto, sem interpretar HTML.

## API

Todas as rotas exigem autenticação Bearer. A autorização é verificada no serviço, incluindo empresa, área ativa, empresa ativa, módulo habilitado e permissão de leitura/gestão. Gestores podem consultar mesmo sem `CanView`.

| Método | Rota | Operação |
| --- | --- | --- |
| GET | `/api/guide/areas` | Áreas habilitadas e autorizadas do usuário |
| GET | `/api/areas/{areaId}/guide` | Categorias, itens e `canManage`; oculta rascunhos de leitores |
| POST | `/api/areas/{areaId}/guide/categories` | Criar categoria |
| PUT / DELETE | `/api/areas/{areaId}/guide/categories/{id}` | Editar/excluir categoria |
| POST | `/api/areas/{areaId}/guide/items` | Criar orientação |
| PUT / DELETE | `/api/areas/{areaId}/guide/items/{id}` | Editar/excluir orientação |
| POST | `/api/areas/{areaId}/guide/items/{id}/file` | Upload multipart, campo `file` |
| GET / DELETE | `/api/areas/{areaId}/guide/items/{id}/file` | Baixar/remover anexo |

Categoria: `{ "name": "Procedimentos", "sortOrder": 0 }`.

Orientação: `{ "categoryId": "UUID", "title": "Abertura", "content": "Instruções", "url": "https://example.com", "sortOrder": 0, "isPublished": false }`.

IDs de categorias e itens precisam pertencer à área da rota. O banco também impõe o vínculo composto categoria/área. Retornos: `201` ao criar, `200` ao consultar/editar, `204` ao excluir/enviar arquivo, `400` para validações ou módulo desabilitado, `401` sem autenticação, `403` sem permissão e `404` para recursos inexistentes/inacessíveis na área.

## Persistência e implantação

A migração `20260926120000_AddGuideModule` cria `guide_categories` e `guide_items`. A API executa as migrações na inicialização, conforme o padrão existente do projeto.

O anexo é armazenado em `bytea` no PostgreSQL, um por orientação, e faz parte do backup do banco. Não é publicado em `/uploads`: o download verifica autorização, usa `Content-Disposition: attachment`, `nosniff` e `Cache-Control: no-store`. A listagem não carrega os bytes dos arquivos. Para volumes altos de documentos, considere migrar o armazenamento para um serviço de objetos privado.

## Ambiente local de demonstração

Inicie os serviços com `docker compose up -d --build` na raiz do projeto. O frontend fica em `http://localhost:3000/app/guide`, a documentação da API em `http://localhost:8080/swagger` e o PostgreSQL em `localhost:5433`, banco `sicou-dev`.

Execute `node scratch/seed_guide_local.mjs` na raiz para preparar a empresa **Sicou - Demonstração Local**, uma unidade, uma área habilitada, categorias, orientações publicadas e em rascunho e um anexo de exemplo. O script reutiliza os registros existentes e verifica autenticação, permissões, consulta e download. Requer Node 22 e Docker Compose. Se Docker não estiver no PATH, configure `SICOU_DOCKER_PATH` com o caminho do executável.

Contas locais: `admin.local@example.test` (administrador), `gestor.local@example.test` (gestão do Orientador) e `leitor.local@example.test` (consulta). A senha inicial é `Local123!`; pode ser definida por `SICOU_LOCAL_PASSWORD` antes da primeira execução. O script não altera senhas de contas existentes. Os dados persistem no volume `Sicou-DB-Data`.

## Testes de integração Python

Arquivo: `scratch/test_guide_module.py`. Usa apenas a biblioteca padrão do Python, sem instalar dependências.

Execute contra uma API ligada a **um banco de desenvolvimento descartável**, com uma conta `SUPER_ADMIN` existente:

```powershell
$env:SICOU_TEST_ADMIN_EMAIL = 'seu-admin-de-testes@example.com'
$env:SICOU_TEST_ADMIN_PASSWORD = '<senha-do-admin-de-testes>'
python scratch/test_guide_module.py --base-url http://localhost:8080
```

Também aceita `SICOU_TEST_BASE_URL`. A senha não é recebida por argumento de linha de comando. A suíte cria empresas, áreas, unidade, usuários e permissões com identificadores únicos. Remove os itens/categorias e chama os endpoints de exclusão dos cadastros ao terminar, inclusive quando há falhas; os cadastros que usam exclusão lógica permanecem inativos no banco.

Os 16 testes cobrem autenticação, seleção de áreas autorizadas, administradores, gestores sem leitura, leitor sem escrita, usuário sem acesso, outra empresa, módulo desabilitado, área inexistente, categorias, ordenação, publicação/despublicação, validações, IDs de outra área, upload/substituição/download/remoção e limites dos anexos. A execução retorna código diferente de zero em falhas.

## Validação desta implementação

- Build de produção do front-end e ESLint dos componentes do Orientador: aprovados.
- Build da solução .NET 8: aprovado, sem erros nem avisos.
- Migrações aplicadas em PostgreSQL 17 temporário; `dotnet ef migrations has-pending-model-changes`: sem diferenças.
- Bateria Python: 16 testes aprovados contra a API real.
- Testes .NET existentes: aprovados (os dois testes existentes são apenas os testes iniciais do projeto).
