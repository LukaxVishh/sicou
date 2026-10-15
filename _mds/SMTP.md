# Recuperação de senha por Gmail

O fluxo **Esqueci minha senha** dispara automaticamente um e-mail ao endereço cadastrado de um usuário ativo. O link permite escolher uma nova senha, expira em 30 minutos e pode ser usado uma vez. Não é necessário agendamento.

## Configuração local

O arquivo `.env.smtp.local`, ignorado pelo Git, contém a configuração de remetente solicitada. Preencha apenas `SMTP_PASSWORD` com uma senha de aplicativo da conta Google. Não use a senha comum nem registre o segredo em documentação.

Para gerar a credencial, habilite a verificação em duas etapas e acesse [Senhas de aplicativo Google](https://myaccount.google.com/apppasswords). Veja a [orientação oficial](https://support.google.com/accounts/answer/185833?hl=pt-BR).

Configuração: `smtp.gmail.com`, porta `587`, STARTTLS (`SMTP_ENABLE_SSL=true`). O endereço deve ser usado tanto em `SMTP_USERNAME` quanto em `SMTP_FROM_ADDRESS`. Para o ambiente local atual, use `SMTP_FRONTEND_BASE_URL=http://localhost:5173`.

## Iniciar a API local com SMTP

Com o PostgreSQL local ativo, confira os campos:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend-smtp.ps1 -ValidateOnly
```

Encerre a API anterior que ocupa a porta 5175 e inicie em outro terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend-smtp.ps1
```

O script carrega as variáveis SMTP apenas para o processo e restaura o ambiente ao encerrar. Usa o SDK local e o banco de demonstração em 127.0.0.1:55439. Uma variável `ConnectionStrings__DefaultConnection` já definida tem prioridade. A validação de campos não comprova autenticação nem entrega.

## Docker Compose

Para o frontend do Compose, altere a URL local para `http://localhost:3000` e execute:

```powershell
docker compose --env-file .env.smtp.local up -d --build
```

## Validar o disparo

Na tela de login, clique em **Esqueci minha senha** e informe um e-mail real cadastrado. Confira recebimento e spam, abra o link e redefina a senha. Endereços `example.test` das contas de demonstração não recebem e-mail. O botão administrativo **Resetar senha** gera senha temporária na tela e permanece um fluxo separado.

A resposta pública não revela se o usuário existe. Falhas SMTP são registradas genericamente nos logs da API; HTTP de sucesso sozinho não comprova entrega. Links localhost funcionam somente no computador que executa o frontend.
