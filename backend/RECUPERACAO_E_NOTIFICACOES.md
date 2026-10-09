# Recuperação de senha e notificações

## Recuperação por confirmação de e-mail (RF-002)

Na tela de login, clique em **Esqueci minha senha** (`/forgot-password`) e informe o e-mail cadastrado. A mensagem recebida contém um link para `/reset-password`, onde o usuário confirma a recuperação definindo sua nova senha. O envio não altera a senha atual nem encerra a sessão; isso ocorre apenas quando o link é confirmado com uma senha válida.

- O link vale por 30 minutos, pode ser usado uma vez e uma nova solicitação invalida o link anterior.
- A API responde de forma igual para e-mails ativos, inexistentes ou inativos, sem retornar tokens. Há limite por IP e rota: cinco solicitações em 15 minutos por padrão.
- O token é protegido pelo Identity e apenas seu hash, vinculado ao e-mail, é persistido no usuário. Mudança de e-mail, senha ou recuperação administrativa invalida os links anteriores.
- A senha definitiva segue a política Identity; a troca encerra sessões anteriores, remove a obrigação de troca de senha temporária e libera o bloqueio por tentativas.
- O link usa a origem configurada do frontend, nunca o cabeçalho Host da requisição. O frontend evita o envio de referrer e remove o token da URL após a confirmação.

Rotas anônimas: `POST /api/auth/forgot-password` recebe `{ "email": "usuario@empresa.com" }`; `POST /api/auth/reset-password` recebe `{ "email": "usuario@empresa.com", "token": "...", "newPassword": "..." }`.

### Caixa local e SMTP real

Execute `docker compose up -d db mail`. A API local em Development usa SMTP `localhost:1025`; consulte os e-mails capturados em **http://localhost:8025**. O serviço Mailpit captura as mensagens localmente, sem entregá-las a destinatários externos. A configuração Docker da API usa `Email__Host=mail` e links para o frontend na porta 3000; a execução local do .NET usa links para a porta 5173. Referência: [documentação oficial do Mailpit](https://mailpit.axllent.org/docs/install/docker/).

Para envio real, configure `Email__Host`, `Email__Port`, `Email__EnableSsl=true`, `Email__Username`, `Email__Password`, `Email__FromAddress` e `Email__FrontendBaseUrl` com a origem HTTPS do frontend. Guarde a senha SMTP em variável de ambiente ou gerenciador de segredos. As configurações locais não habilitam envio para caixas reais. Se o SMTP falhar, a API mantém a resposta neutra e registra uma falha de entrega sem expor endereço ou token; o usuário deve solicitar um novo link após normalizar o SMTP.

A migration `AddEmailPasswordRecovery` acrescenta os campos de hash e validade em `users`. A suíte `scratch/test_email_password_recovery.py` valida o recebimento real no SMTP local, a confirmação, uso único, expiração, troca de e-mail, links substituídos, invalidação de sessões e coexistência com recuperação administrativa. Use apenas banco descartável e Mailpit local, com as mesmas variáveis dos testes administrativos. Na suíte isolada, `Email__RequestLimit=100` permite executar os cenários antes de testar o bloqueio de excesso.

## Recuperação administrativa

Abra **Recuperação de senha** no menu geral (`/app/password-recovery`). Selecione o usuário e gere a senha temporária. Entregue-a ao usuário por um canal privado; o Sicou não envia a senha por e-mail e não guarda seu valor em texto puro.

- Apenas `SUPER_ADMIN` e `COMPANY_ADMIN` podem gerar senhas temporárias.
- Super Admin pode recuperar cargos inferiores. Admin da Empresa pode recuperar Admin de Área e usuários da própria empresa ativa. Recuperação do próprio usuário, de pares ou de superiores é recusada.
- A senha é gerada com aleatoriedade criptográfica, exibida na resposta da geração e válida por 24 horas. Uma nova geração substitui a anterior.
- A senha anterior e os tokens anteriores deixam de funcionar. O bloqueio por tentativas é liberado na recuperação.
- O usuário entra pela tela normal de login. Enquanto a troca estiver pendente, a API permite apenas consultar a própria sessão e definir a senha definitiva; o frontend redireciona para `/change-password`.
- A senha definitiva deve ser diferente da temporária e cumprir a política Identity: 8 caracteres, maiúscula, minúscula e número. A troca gera uma sessão nova e invalida a sessão temporária.
- A recuperação registra o administrador responsável e a data no usuário.

Rotas:

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/password-recovery/users` | Usuários elegíveis no escopo do administrador |
| POST | `/api/password-recovery/users/{id}/temporary-password` | Gerar senha temporária |
| POST | `/api/auth/change-password` | `{ "currentPassword": "...", "newPassword": "..." }` |

JWTs incluem o security stamp do usuário e ele é conferido a cada requisição. Tokens emitidos antes desta atualização exigem novo login. O endpoint antigo de promoção para Super Admin agora exige autenticação de Super Admin; o primeiro administrador deve ser provisionado por um processo controlado, fora da API pública.

## Notificações no sistema

O sino no cabeçalho mostra avisos, quantidade de não lidos, paginação e comandos para marcar um ou todos como lidos. A consulta atualiza ao abrir e a cada 30 segundos enquanto a aba estiver visível. O estado de leitura fica no PostgreSQL e persiste entre sessões.

As empresas permanecem isoladas. Um comunicado geral com empresa definida avisa os usuários ativos daquela empresa. Um comunicado de área avisa usuários com acesso ativo àquela área e administradores da empresa. Setores da mesma empresa podem receber avisos de outra área quando têm acesso a ela. Publicações antigas sem empresa definida não geram avisos entre empresas.

São observadas gravações de comunicados (criação, edição, exclusão e fixação), categorias e orientações, anexos do Orientador, processos (rascunho, protocolo, tramitação, devolução, reinício e comentários), configuração de workflows, áreas, módulos e permissões. Consultas e downloads não geram notificações. O autor da ação não recebe seu próprio aviso.

Rascunhos do Orientador e configurações de workflow são destinados aos gestores autorizados. Avisos de processos respeitam a empresa, acesso da área, autor e unidade de origem. Os avisos do Orientador identificam a ação, o título da orientação ou nome da categoria e a área: nova orientação, novo rascunho, atualização, remoção, publicação/despublicação e adição/atualização/remoção de anexo. Não incluem o conteúdo dos documentos ou processos. Títulos de rascunhos são enviados somente a gestores do Orientador. As permissões são reavaliadas ao listar e marcar avisos: revogar acesso à área impede consultar seus avisos antigos.

Os avisos são gravados pelo contexto EF na mesma transação da ação. Não há serviço externo de e-mail, push ou mensageria.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/notifications?page=1&pageSize=20` | Lista e contagem de não lidos |
| PUT | `/api/notifications/{id}/read` | Marcar um aviso próprio como lido |
| PUT | `/api/notifications/read-all` | Marcar os avisos visíveis do usuário como lidos |

## Banco e testes

A migration `AddPasswordRecoveryAndNotifications` adiciona os campos de recuperação em `users` e a tabela `user_notifications`. A API aplica as migrations na inicialização.

`scratch/test_password_recovery_notifications.py` testa via HTTP autenticação, hierarquia, escopo de empresa, expiração, invalidação de senhas e sessões, troca obrigatória, eventos de comunicado/Orientador/workflow, leitura individual e em lote e revogação de acesso. Execute somente contra um banco descartável, com `SICOU_TEST_BASE_URL`, `SICOU_TEST_ADMIN_EMAIL` e `SICOU_TEST_ADMIN_PASSWORD`. O teste de expiração usa também `SICOU_TEST_DATABASE`, `SICOU_TEST_PSQL` e credenciais PostgreSQL no ambiente, exigindo nome de banco iniciado por `sicou_feature_tests_`.

O build do frontend executa uma conferência do JavaScript gerado para impedir um pacote sem inicialização React e sem as novas telas. A otimização de tree shaking do Rolldown atual foi desabilitada porque removia a aplicação do pacote; o bundle fica maior e poderá ser otimizado novamente quando essa conferência continuar passando com o otimizador habilitado.
