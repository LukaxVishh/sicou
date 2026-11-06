# Agente de monitoramento Sicou

Requer Python 3.10+; não instala dependências. Configure o cadastro em **Integrações → Execuções das automações** e crie token com escopo `automations:write`.

Disponibilize as variáveis no gerenciador de segredos/ambiente do serviço local:

- `SICOU_API_URL`: origem HTTPS da API (sem `/api`). HTTP somente para localhost em testes.
- `SICOU_AUTOMATION_ID`: ID do cadastro exibido no Sicou.
- `SICOU_INTEGRATION_TOKEN`: segredo do token, exibido uma única vez ao criar.

Execute a rotina por meio do agente:

```sh
python3 sicou_agent.py -- python3 /opt/automacoes/financeiro.py
```

Para comandos que precisam de argumentos, coloque-os depois do executável. O agente não usa shell nem recebe comandos do Sicou. Agende essa linha com o gerenciador local apropriado, usando o mesmo usuário e diretório de trabalho que a automação exige. Não execute em paralelo a rotina original e a rotina encapsulada; invocações separadas são execuções diferentes.

São enviados início, atividade a cada 10 segundos, código de saída e resumo do resultado. Stdout/stderr permanecem locais; não inclua segredos nos resumos enviados manualmente pela API. Em caso de queda de comunicação o servidor pode classificar a execução como interrompida. Não há fila offline durável. Instalação em produção depende da equipe da empresa.

Consulte [contratos, limites, interrupções e comportamento de repetição](../backend/INTEGRACOES.md#monitoramento-de-execucoes).
