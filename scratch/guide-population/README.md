# População acadêmica do Orientador

Execute **da raiz do repositório**, com a API local e os setores Operações, Recursos Humanos e Tecnologia já existentes na **Empresa demonstração Orientador**:

```powershell
npm.cmd --prefix scratch/guide-population install
node scratch/guide-population/seed.mjs
```

Por padrão, usa a API `http://localhost:8080` e as credenciais administrativas locais em `.cache/guide-demo-credentials.json` (ignorado pelo Git). Alternativamente, defina `SICOU_SEED_API`, `SICOU_SEED_EMAIL` e `SICOU_SEED_PASSWORD` no ambiente do processo. Não coloque as credenciais no script nem no controle de versão. A carga rejeita hosts externos e não cria contas, setores ou permissões.

São 24 orientações por setor, em seis tipos: Manuais e procedimentos, Checklists, Modelos e formulários, Planilhas de controle, Perguntas frequentes e Guias rápidos. Cada setor recebe 22 publicações, dois rascunhos e 20 anexos: oito PDFs, quatro DOCX e oito CSV. CSVs são planilhas de apoio compatíveis com Excel; não são arquivos XLSX. Todos os exemplos são fictícios e identificados como material acadêmico.

Reexecutar procura tipos por nome e itens por título dentro do setor, preservando cadastros e anexos existentes. Upload interrompido pode ser retomado se o item ainda tiver o conteúdo original da carga. Não execute duas instâncias simultaneamente. O script usa as APIs normais, portanto gera os avisos internos do Orientador para os usuários autorizados. Não solicita envio de e-mail.

Arquivos gerados e resumo ficam em `.cache/guide-population/`, ignorados pelo Git. A execução confirma a presença dos 72 itens e recupera os 60 anexos pela API para verificar que não estão vazios. A carga não certifica políticas institucionais nem homologação dos visualizadores.

As dependências pertencem somente a este utilitário; não entram nos bundles do frontend/backend. `SICOU_SEED_MODULE_ROOT` permite usar módulos já instalados em outro diretório Node durante a manutenção local.
