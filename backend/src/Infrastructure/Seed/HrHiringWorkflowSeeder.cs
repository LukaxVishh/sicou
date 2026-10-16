using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Seed;

public static class HrHiringWorkflowSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var companies = await db.Companies
            .Where(c => c.IsActive)
            .ToListAsync();

        if (companies.Count == 0)
            return;

        // Ensure Workflows module exists
        var workflowModule = await db.Modules
            .FirstOrDefaultAsync(m => m.Code == ModuleCode.Workflows);

        if (workflowModule is null)
        {
            workflowModule = new Module
            {
                Id = Guid.NewGuid(),
                Code = ModuleCode.Workflows,
                Name = "Workflows e Processos",
                Description = "Gestão de árvores de decisão e tramitação de processos",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            db.Modules.Add(workflowModule);
            await db.SaveChangesAsync();
        }

        foreach (var company in companies)
        {
            await SeedForCompanyAsync(db, company, workflowModule);
        }
    }

    private static async Task SeedForCompanyAsync(ApplicationDbContext db, Company company, Module workflowModule)
    {
        // 1. Ensure Required Units / Departments exist in the Company
        var requiredUnits = new (string Code, string Name)[]
        {
            ("MKT", "Marketing"),
            ("RH-TRIAGEM", "Recursos Humanos - Triagem / Atração de Talentos"),
            ("RH-GERENCIA", "Gerência de Recursos Humanos"),
            ("DIRETORIA", "Diretoria"),
            ("DP-ADMISSAO", "Departamento Pessoal / Validação Documental")
        };

        var existingUnits = await db.Units
            .Where(u => u.CompanyId == company.Id)
            .ToListAsync();

        foreach (var (code, name) in requiredUnits)
        {
            var unit = existingUnits.FirstOrDefault(u =>
                string.Equals(u.Code, code, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(u.Name, name, StringComparison.OrdinalIgnoreCase));

            if (unit is null)
            {
                unit = new Unit
                {
                    Id = Guid.NewGuid(),
                    CompanyId = company.Id,
                    Code = code,
                    Name = name,
                    City = "São Paulo",
                    State = "SP",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                db.Units.Add(unit);
                existingUnits.Add(unit);
            }
            else if (!unit.IsActive)
            {
                unit.IsActive = true;
                unit.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();

        // 2. Ensure Area "Recursos Humanos" exists in the Company
        var hrArea = await db.Areas
            .Include(a => a.AreaModules)
            .FirstOrDefaultAsync(a =>
                a.CompanyId == company.Id &&
                (a.Slug == "recursos-humanos" || a.Name.ToLower() == "recursos humanos" || a.Slug == "rh"));

        if (hrArea is null)
        {
            hrArea = new Area
            {
                Id = Guid.NewGuid(),
                CompanyId = company.Id,
                Name = "Recursos Humanos",
                Slug = "recursos-humanos",
                Description = "Gestão de Pessoas, Atração de Talentos, Remuneração e Departamento Pessoal.",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            db.Areas.Add(hrArea);
            await db.SaveChangesAsync();
        }
        else if (!hrArea.IsActive)
        {
            hrArea.IsActive = true;
            hrArea.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        // Ensure Workflows module is enabled for Recursos Humanos area
        var hasWorkflowModule = hrArea.AreaModules.Any(am => am.ModuleId == workflowModule.Id);
        if (!hasWorkflowModule)
        {
            db.AreaModules.Add(new AreaModule
            {
                Id = Guid.NewGuid(),
                AreaId = hrArea.Id,
                ModuleId = workflowModule.Id,
                Enabled = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // 3. Ensure Custom FieldDefinitions exist in Recursos Humanos
        var fieldSpecs = new (string Code, string Name, string Description, string Placeholder, FieldType Type, string? OptionsJson)[]
        {
            // Dados da Vaga
            ("cargo", "Cargo da Vaga", "Título oficial do cargo para contratação.", "Ex: Analista de Marketing Digital", FieldType.Text, null),
            ("nivel", "Nível de Senioridade", "Nível hierárquico ou senioridade da posição.", "Selecione o nível", FieldType.Select, "[\"Júnior\",\"Pleno\",\"Sênior\",\"Especialista\",\"Coordenação / Gerência\"]"),
            ("salario_proposto", "Salário Proposto (R$)", "Remuneração mensal bruta proposta para a vaga.", "Ex: 6500.00", FieldType.Currency, null),
            ("justificativa_contratacao", "Justificativa da Contratação", "Motivo da abertura da vaga (aumento de quadro, substituição, novo projeto).", "Descreva a necessidade da área solicitante...", FieldType.TextArea, null),
            ("data_previsao_inicio", "Data Prevista de Início", "Expectativa de início das atividades do novo colaborador.", "Selecione a data", FieldType.Date, null),

            // Dados do Candidato
            ("nome_candidato", "Nome Completo do Candidato Finalista", "Nome completo do candidato aprovado na etapa de triagem e entrevistas.", "Ex: Mariana Costa Silva", FieldType.Text, null),
            ("email", "E-mail do Candidato", "Endereço de e-mail principal do candidato selecionado.", "Ex: mariana.costa@email.com", FieldType.Text, null),
            ("telefone", "Telefone / WhatsApp do Candidato", "Telefone de contato com DDD.", "Ex: (11) 98765-4321", FieldType.Text, null),
            ("curriculo_anexo", "Currículo / Portfólio (Referência ou Link)", "Identificação do arquivo de currículo anexado ou link do perfil profissional.", "Ex: Curriculo_Mariana_Costa.pdf", FieldType.Text, null),

            // Pareceres / Aprovações
            ("parecer_gerente_rh", "Parecer da Gerência de RH", "Avaliação técnica sobre aderência salarial, fit cultural e faixa de remuneração.", "Registre a avaliação da Gerência de RH...", FieldType.TextArea, null),
            ("parecer_diretoria", "Parecer Orçamentário da Diretoria", "Deliberação executiva sobre aprovação orçamentária da contratação.", "Registre a decisão da Diretoria...", FieldType.TextArea, null),
            ("status_documentacao", "Status da Validação Documental", "Resultado da conferência dos documentos admissionais pelo DP.", "Selecione o status", FieldType.Select, "[\"Documentação Completa e Validada\",\"Documentação com Ressalvas\",\"Documentação Pendente / Incompatível\"]"),
            ("motivo_rejeicao", "Motivo da Rejeição / Indeferimento", "Justificativa formal caso a solicitação seja reprovada.", "Descreva o motivo da reprovação...", FieldType.TextArea, null),

            // Documentos Admissionais
            ("anexo_rg_cpf", "Documento de Identificação (RG / CPF)", "Número ou referência do documento de identificação validado.", "Ex: RG 12.345.678-9 / CPF 123.456.789-00 (Validado)", FieldType.Text, null),
            ("anexo_comprovante_residencia", "Comprovante de Residência", "Confirmação ou referência do comprovante de endereço atualizado.", "Ex: Comprovante_Endereco_Luz.pdf (Validado)", FieldType.Text, null),
            ("anexo_carteira_trabalho", "Carteira de Trabalho Digital (CTPS / PIS)", "Número do PIS/PASEP ou validação da CTPS Digital para o eSocial.", "Ex: CTPS Digital Validada - PIS 123.45678.90-1", FieldType.Text, null)
        };

        var existingFields = await db.FieldDefinitions
            .Where(f => f.AreaId == hrArea.Id)
            .ToListAsync();

        var fieldMap = new Dictionary<string, FieldDefinition>(StringComparer.OrdinalIgnoreCase);

        foreach (var spec in fieldSpecs)
        {
            var field = existingFields.FirstOrDefault(f => string.Equals(f.Code, spec.Code, StringComparison.OrdinalIgnoreCase));
            if (field is null)
            {
                field = new FieldDefinition
                {
                    Id = Guid.NewGuid(),
                    AreaId = hrArea.Id,
                    Code = spec.Code,
                    Name = spec.Name,
                    Description = spec.Description,
                    Placeholder = spec.Placeholder,
                    Type = spec.Type,
                    GlobalOptionsJson = spec.OptionsJson,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                db.FieldDefinitions.Add(field);
                existingFields.Add(field);
            }
            else
            {
                field.IsActive = true;
                field.Name = spec.Name;
                field.Description = spec.Description;
                field.Placeholder = spec.Placeholder;
                field.Type = spec.Type;
                field.GlobalOptionsJson = spec.OptionsJson;
                field.UpdatedAt = DateTime.UtcNow;
            }

            fieldMap[spec.Code] = field;
        }

        await db.SaveChangesAsync();

        // 4. Ensure ProcessNodes exist in Recursos Humanos
        var nodeSpecs = new (string Code, string Name, string Description, ProcessNodeType NodeType)[]
        {
            ("N1-ABERTURA-MKT", "Abertura da Solicitação (Marketing)", "Etapa inicial de confecção da vaga pela unidade solicitante (Marketing).", ProcessNodeType.StartConfection),
            ("N2-TRIAGEM-RH", "Triagem e Entrevistas (Analista de RH)", "Recursos Humanos - Triagem / Atração de Talentos: seleção e cadastro dos dados do candidato finalista.", ProcessNodeType.StandardStage),
            ("N3-GERENCIA-RH", "Aprovação da Gerência de RH", "Gerência de Recursos Humanos: avaliação de aderência salarial, perfil e emissão de parecer técnico.", ProcessNodeType.StandardStage),
            ("N4-DIRETORIA", "Aprovação da Diretoria", "Diretoria Executiva: validação e aprovação orçamentária final para emissão de carta proposta.", ProcessNodeType.StandardStage),
            ("N5-VALIDACAO-DP", "Validação de Documentação e Admissão (DP / RH)", "Departamento Pessoal / Validação Documental: conferência de documentos admissionais e registro.", ProcessNodeType.StandardStage),
            ("NF-DEFERIDO", "Contratação Efetivada (Deferido)", "Nó terminal de aprovação: admissão concluída e colaborador integrado.", ProcessNodeType.EndApproved),
            ("NF-INDEFERIDO", "Solicitação Reprovada (Indeferido)", "Nó terminal de reprovação: processo encerrado com justificativa formal.", ProcessNodeType.EndRejected)
        };

        var existingNodes = await db.ProcessNodes
            .Where(n => n.AreaId == hrArea.Id)
            .ToListAsync();

        var nodeMap = new Dictionary<string, ProcessNode>(StringComparer.OrdinalIgnoreCase);

        foreach (var spec in nodeSpecs)
        {
            var node = existingNodes.FirstOrDefault(n => string.Equals(n.Code, spec.Code, StringComparison.OrdinalIgnoreCase));
            if (node is null)
            {
                node = new ProcessNode
                {
                    Id = Guid.NewGuid(),
                    AreaId = hrArea.Id,
                    Code = spec.Code,
                    Name = spec.Name,
                    Description = spec.Description,
                    NodeType = spec.NodeType,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                db.ProcessNodes.Add(node);
                existingNodes.Add(node);
            }
            else
            {
                node.IsActive = true;
                node.Name = spec.Name;
                node.Description = spec.Description;
                node.NodeType = spec.NodeType;
                node.UpdatedAt = DateTime.UtcNow;
            }

            nodeMap[spec.Code] = node;
        }

        await db.SaveChangesAsync();

        // 5. Ensure Homologated ProcessType "Contratação de Novo Colaborador" exists
        var existingTree = await db.ProcessTypes
            .Include(pt => pt.Nodes)
            .Include(pt => pt.Fields)
            .Include(pt => pt.Transitions)
            .FirstOrDefaultAsync(pt =>
                pt.AreaId == hrArea.Id &&
                pt.Code == "RH-CONTRATACAO" &&
                pt.IsActive);

        if (existingTree is null)
        {
            var treeId = Guid.NewGuid();
            var n1 = nodeMap["N1-ABERTURA-MKT"];
            var n2 = nodeMap["N2-TRIAGEM-RH"];
            var n3 = nodeMap["N3-GERENCIA-RH"];
            var n4 = nodeMap["N4-DIRETORIA"];
            var n5 = nodeMap["N5-VALIDACAO-DP"];
            var nDeferido = nodeMap["NF-DEFERIDO"];
            var nIndeferido = nodeMap["NF-INDEFERIDO"];

            var processType = new ProcessType
            {
                Id = treeId,
                AreaId = hrArea.Id,
                FamilyId = Guid.NewGuid(),
                VersionNumber = 1,
                Code = "RH-CONTRATACAO",
                Name = "Contratação de Novo Colaborador",
                Description = "Fluxo corporativo completo de recrutamento, seleção, alçadas de aprovação (Gerência de RH e Diretoria) e admissão pelo Departamento Pessoal.",
                TargetAudience = ProcessAudience.All,
                Status = ProcessTypeStatus.Homologated,
                StartNodeId = n1.Id,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            // Add Nodes with explicit spatial coordinates (CoordinateX, CoordinateY) and opinion configuration
            processType.Nodes = new List<ProcessTypeNode>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    ProcessTypeId = treeId,
                    ProcessNodeId = n1.Id,
                    Order = 1,
                    CoordinateX = 80,
                    CoordinateY = 220,
                    Instructions = "{\"text\":\"Preencha os dados da vaga solicitada pelo Marketing.\",\"opinion\":{\"enabled\":false,\"required\":false,\"hidden\":false,\"conditions\":[]}}",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    ProcessTypeId = treeId,
                    ProcessNodeId = n2.Id,
                    Order = 2,
                    CoordinateX = 440,
                    CoordinateY = 220,
                    Instructions = "{\"text\":\"Informe os dados do candidato finalista aprovado na triagem e anexe o currículo.\",\"opinion\":{\"enabled\":true,\"required\":false,\"hidden\":false,\"conditions\":[]}}",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    ProcessTypeId = treeId,
                    ProcessNodeId = n3.Id,
                    Order = 3,
                    CoordinateX = 800,
                    CoordinateY = 220,
                    Instructions = "{\"text\":\"Avalie a aderência salarial e perfil do candidato. O parecer da Gerência de RH é obrigatório.\",\"opinion\":{\"enabled\":true,\"required\":true,\"hidden\":false,\"conditions\":[]}}",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    ProcessTypeId = treeId,
                    ProcessNodeId = n4.Id,
                    Order = 4,
                    CoordinateX = 1160,
                    CoordinateY = 220,
                    Instructions = "{\"text\":\"Deliberação executiva sobre aprovação orçamentária final da contratação.\",\"opinion\":{\"enabled\":true,\"required\":true,\"hidden\":false,\"conditions\":[]}}",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    ProcessTypeId = treeId,
                    ProcessNodeId = n5.Id,
                    Order = 5,
                    CoordinateX = 1520,
                    CoordinateY = 220,
                    Instructions = "{\"text\":\"Confira os documentos admissionais (RG/CPF, Comprovante de Residência e CTPS Digital) antes de efetivar a contratação.\",\"opinion\":{\"enabled\":true,\"required\":true,\"hidden\":false,\"conditions\":[]}}",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    ProcessTypeId = treeId,
                    ProcessNodeId = nDeferido.Id,
                    Order = 6,
                    CoordinateX = 1880,
                    CoordinateY = 100,
                    Instructions = "{\"text\":\"Contratação efetivada e admissão concluída com sucesso.\",\"opinion\":{\"enabled\":false,\"required\":false,\"hidden\":false,\"conditions\":[]}}",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.NewGuid(),
                    ProcessTypeId = treeId,
                    ProcessNodeId = nIndeferido.Id,
                    Order = 7,
                    CoordinateX = 1160,
                    CoordinateY = 520,
                    Instructions = "{\"text\":\"Solicitação reprovada. Justificativa formal obrigatória.\",\"opinion\":{\"enabled\":true,\"required\":true,\"hidden\":false,\"conditions\":[]}}",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                }
            };

            // Add Fields bound to their respective stages
            processType.Fields = new List<ProcessTypeField>
            {
                // [Nó 1] Abertura da Solicitação (Marketing) - Obrigatórios
                CreateField(treeId, n1.Id, fieldMap["cargo"].Id, true, 1, "Cargo da Vaga", "Informe a nomenclatura oficial do cargo."),
                CreateField(treeId, n1.Id, fieldMap["nivel"].Id, true, 2, "Nível da Vaga", "Selecione a senioridade esperada."),
                CreateField(treeId, n1.Id, fieldMap["salario_proposto"].Id, true, 3, "Salário Proposto (R$)", "Informe o valor bruto mensal em reais."),
                CreateField(treeId, n1.Id, fieldMap["justificativa_contratacao"].Id, true, 4, "Justificativa da Contratação", "Detalhe o motivo da abertura da posição."),
                CreateField(treeId, n1.Id, fieldMap["data_previsao_inicio"].Id, true, 5, "Data Prevista de Início", "Data planejada para início das atividades."),

                // [Nó 2] Triagem e Entrevistas (Analista de RH) - Obrigatórios na etapa 2
                CreateField(treeId, n2.Id, fieldMap["nome_candidato"].Id, true, 6, "Nome do Candidato Selecionado", "Nome completo do finalista aprovado nas entrevistas."),
                CreateField(treeId, n2.Id, fieldMap["email"].Id, true, 7, "E-mail do Candidato", "E-mail para envio de proposta e admissão."),
                CreateField(treeId, n2.Id, fieldMap["telefone"].Id, true, 8, "Telefone do Candidato", "Telefone/WhatsApp com DDD."),
                CreateField(treeId, n2.Id, fieldMap["curriculo_anexo"].Id, true, 9, "Currículo / Portfólio (Anexo ou Link)", "Referência do arquivo de currículo anexado ao processo."),

                // [Nó 3] Aprovação da Gerência de RH - Obrigatório na etapa 3
                CreateField(treeId, n3.Id, fieldMap["parecer_gerente_rh"].Id, true, 10, "Parecer Técnico da Gerência de RH", "Avaliação de aderência salarial e perfil comportamental/técnico."),

                // [Nó 4] Aprovação da Diretoria - Obrigatório na etapa 4
                CreateField(treeId, n4.Id, fieldMap["parecer_diretoria"].Id, true, 11, "Parecer Executivo da Diretoria", "Aprovação orçamentária final para contratação."),

                // [Nó 5] Validação de Documentação e Admissão (DP / RH) - Obrigatórios na etapa 5
                CreateField(treeId, n5.Id, fieldMap["anexo_rg_cpf"].Id, true, 12, "Anexo / Conferência RG e CPF", "Identificação do documento de RG/CPF conferido."),
                CreateField(treeId, n5.Id, fieldMap["anexo_comprovante_residencia"].Id, true, 13, "Anexo / Comprovante de Residência", "Identificação do comprovante de endereço conferido."),
                CreateField(treeId, n5.Id, fieldMap["anexo_carteira_trabalho"].Id, true, 14, "Anexo / Carteira de Trabalho Digital (CTPS)", "Validação da CTPS Digital e PIS."),
                CreateField(treeId, n5.Id, fieldMap["status_documentacao"].Id, true, 15, "Status da Conferência Documental", "Resultado da validação pelo Departamento Pessoal."),

                // [Nó Indeferido] Motivo de Rejeição (opcional no cadastro geral, exigido se reprovado)
                CreateField(treeId, nIndeferido.Id, fieldMap["motivo_rejeicao"].Id, false, 16, "Motivo da Rejeição", "Justificativa caso a solicitação seja reprovada.")
            };

            // Add Transitions
            processType.Transitions = new List<ProcessTransition>
            {
                // [Nó 1] -> [Nó 2]
                CreateTransition(treeId, n1.Id, n2.Id, allowAdvance: true, allowReturn: true, allowRestart: true),

                // [Nó 2] -> [Nó 3] (Candidato Selecionado) e permite devolução do Nó 3 para o Nó 2
                CreateTransition(treeId, n2.Id, n3.Id, allowAdvance: true, allowReturn: true, allowRestart: true),
                // [Nó 2] -> [Indeferido] (Sem Perfil / Vaga Cancelada na Triagem)
                CreateTransition(treeId, n2.Id, nIndeferido.Id, allowAdvance: true, allowReturn: false, allowRestart: false),

                // [Nó 3] -> [Nó 4] (Aprovar)
                CreateTransition(treeId, n3.Id, n4.Id, allowAdvance: true, allowReturn: true, allowRestart: true),
                // [Nó 3] -> [Indeferido] (Reprovar)
                CreateTransition(treeId, n3.Id, nIndeferido.Id, allowAdvance: true, allowReturn: false, allowRestart: false),

                // [Nó 4] -> [Nó 5] (Aprovado pela Diretoria) e permite devolução do Nó 5 para o Nó 4
                CreateTransition(treeId, n4.Id, n5.Id, allowAdvance: true, allowReturn: true, allowRestart: true),
                // [Nó 4] -> [Indeferido] (Recusado pela Diretoria)
                CreateTransition(treeId, n4.Id, nIndeferido.Id, allowAdvance: true, allowReturn: false, allowRestart: false),

                // [Nó 5] -> [Deferido] (Documentação OK -> Contratação Efetivada)
                CreateTransition(treeId, n5.Id, nDeferido.Id, allowAdvance: true, allowReturn: false, allowRestart: false),
                // [Nó 5] -> [Nó 2] (Retorno direto para Triagem caso documentação/candidato seja incompatível)
                CreateTransition(treeId, n5.Id, n2.Id, allowAdvance: true, allowReturn: true, allowRestart: true),
                // [Nó 5] -> [Indeferido] (Reprovar na validação documental)
                CreateTransition(treeId, n5.Id, nIndeferido.Id, allowAdvance: true, allowReturn: false, allowRestart: false)
            };

            db.ProcessTypes.Add(processType);
            await db.SaveChangesAsync();
        }
        else if (existingTree.Status != ProcessTypeStatus.Homologated)
        {
            existingTree.Status = ProcessTypeStatus.Homologated;
            existingTree.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        // 6. Grant UserAreaAccess and UserProcessNodes to active users of this company so they can test all stages immediately
        var companyUsers = await db.Users
            .Where(u => (u.CompanyId == company.Id || u.CompanyId == null) && u.IsActive)
            .ToListAsync();

        var existingAccesses = await db.UserAreaAccesses
            .Where(a => a.AreaId == hrArea.Id)
            .ToListAsync();

        var allHrNodeIds = nodeMap.Values.Select(n => n.Id).ToList();
        var existingUserNodes = await db.UserProcessNodes
            .Where(upn => allHrNodeIds.Contains(upn.ProcessNodeId))
            .ToListAsync();

        foreach (var user in companyUsers)
        {
            var userIdStr = user.Id.ToString();
            var access = existingAccesses.FirstOrDefault(a => a.UserId == userIdStr);
            if (access is null)
            {
                db.UserAreaAccesses.Add(new UserAreaAccess
                {
                    Id = Guid.NewGuid(),
                    UserId = userIdStr,
                    CompanyId = company.Id,
                    UnitId = user.UnitId,
                    AreaId = hrArea.Id,
                    CanView = true,
                    CanManage = true,
                    CanPublishInformatives = true,
                    CanManageGuide = true,
                    CanManageWorkflows = true,
                    CanHandleWorkflowRequests = true,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else if (!access.IsActive)
            {
                access.IsActive = true;
                access.CanView = true;
                access.CanHandleWorkflowRequests = true;
                access.CanManageWorkflows = true;
                access.UpdatedAt = DateTime.UtcNow;
            }

            foreach (var nodeId in allHrNodeIds)
            {
                var userNode = existingUserNodes.FirstOrDefault(un => un.UserId == userIdStr && un.ProcessNodeId == nodeId);
                if (userNode is null)
                {
                    db.UserProcessNodes.Add(new UserProcessNode
                    {
                        Id = Guid.NewGuid(),
                        UserId = userIdStr,
                        ProcessNodeId = nodeId,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                else if (!userNode.IsActive)
                {
                    userNode.IsActive = true;
                    userNode.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        await db.SaveChangesAsync();
    }

    private static ProcessTypeField CreateField(
        Guid processTypeId,
        Guid processNodeId,
        Guid fieldDefinitionId,
        bool isRequired,
        int displayOrder,
        string customLabel,
        string helpText)
    {
        return new ProcessTypeField
        {
            Id = Guid.NewGuid(),
            ProcessTypeId = processTypeId,
            ProcessNodeId = processNodeId,
            FieldDefinitionId = fieldDefinitionId,
            IsRequired = isRequired,
            DisplayOrder = displayOrder,
            CustomLabel = customLabel,
            HelpText = helpText,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
    }

    private static ProcessTransition CreateTransition(
        Guid processTypeId,
        Guid fromNodeId,
        Guid toNodeId,
        bool allowAdvance,
        bool allowReturn,
        bool allowRestart)
    {
        return new ProcessTransition
        {
            Id = Guid.NewGuid(),
            ProcessTypeId = processTypeId,
            FromNodeId = fromNodeId,
            ToNodeId = toNodeId,
            AllowAdvance = allowAdvance,
            AllowReturn = allowReturn,
            AllowRestart = allowRestart,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
    }
}
