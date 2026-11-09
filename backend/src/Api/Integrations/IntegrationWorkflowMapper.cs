using System.Text.Json;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Enums;

namespace Sicou.Api.Integrations;

/// <summary>Traduções entre o contrato amigável a agentes (códigos) e o contrato interno (IDs).</summary>
public static class IntegrationWorkflowMapper
{
    public static readonly IReadOnlyDictionary<ProcessStatus, string> StatusLabels = new Dictionary<ProcessStatus, string>
    {
        [ProcessStatus.Draft] = "Rascunho",
        [ProcessStatus.InReview] = "Em análise",
        [ProcessStatus.Returned] = "Devolvido",
        [ProcessStatus.Approved] = "Deferido",
        [ProcessStatus.Rejected] = "Indeferido",
        [ProcessStatus.Finished] = "Concluído",
        [ProcessStatus.AdministrativeCancellation] = "Cancelado administrativamente"
    };

    public static bool IsTerminal(ProcessStatus status) =>
        status is ProcessStatus.Approved or ProcessStatus.Rejected or ProcessStatus.Finished or ProcessStatus.AdministrativeCancellation;

    /// <summary>Converte as chaves (código ou ID) para IDs de definição de campo pertencentes à árvore.</summary>
    public static Dictionary<Guid, string?> ResolveFields(IntegrationFieldValues? fields, ProcessTypeResponse tree)
    {
        var result = new Dictionary<Guid, string?>();
        if (fields is null || fields.Count == 0) return result;

        var definitions = tree.Fields
            .GroupBy(f => f.FieldDefinitionId)
            .Select(g => g.First())
            .ToList();
        var byId = definitions.ToDictionary(f => f.FieldDefinitionId);
        var byCode = definitions
            .Where(f => !string.IsNullOrWhiteSpace(f.Code))
            .GroupBy(f => f.Code.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var unknown = new List<string>();
        foreach (var (key, value) in fields)
        {
            var trimmed = key.Trim();
            ProcessTypeFieldResponse? field = null;
            if (Guid.TryParse(trimmed, out var id)) byId.TryGetValue(id, out field);
            else byCode.TryGetValue(trimmed, out field);

            if (field is null)
            {
                unknown.Add(key);
                continue;
            }
            result[field.FieldDefinitionId] = ToText(value, key);
        }

        if (unknown.Count > 0)
        {
            var valid = string.Join(", ", byCode.Keys.OrderBy(k => k));
            throw new InvalidOperationException(
                $"Campo(s) inexistente(s) neste workflow: {string.Join(", ", unknown)}. Códigos válidos: {(valid.Length > 0 ? valid : "nenhum")}.");
        }
        return result;
    }

    public static string? ToText(JsonElement value, string key) => value.ValueKind switch
    {
        JsonValueKind.Null or JsonValueKind.Undefined => null,
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number => value.GetRawText(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        JsonValueKind.Array => string.Join(",", value.EnumerateArray().Select(item => item.ValueKind switch
        {
            JsonValueKind.String => item.GetString()?.Trim(),
            JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => item.GetRawText(),
            _ => throw new InvalidOperationException($"O campo '{key}' aceita lista somente de textos, números ou booleanos.")
        })),
        _ => throw new InvalidOperationException($"O campo '{key}' não aceita objeto JSON; envie texto, número, booleano ou lista.")
    };

    /// <summary>Resolve a etapa de destino por ID ou por código. Retorna nulo quando nenhum foi informado.</summary>
    public static Guid? ResolveNode(Guid? nodeId, string? nodeCode, ProcessTypeResponse tree)
    {
        if (string.IsNullOrWhiteSpace(nodeCode)) return nodeId;

        var node = tree.Nodes.FirstOrDefault(n => string.Equals(n.Code.Trim(), nodeCode.Trim(), StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException(
                $"Etapa '{nodeCode}' não existe neste workflow. Códigos válidos: {string.Join(", ", tree.Nodes.Select(n => n.Code).OrderBy(c => c))}.");
        if (nodeId.HasValue && nodeId.Value != node.ProcessNodeId)
            throw new InvalidOperationException("targetNodeId e targetNodeCode apontam para etapas diferentes.");
        return node.ProcessNodeId;
    }

    private static IntegrationNodeRef NodeRef(ProcessTypeResponse tree, Guid nodeId, string fallbackName, ProcessNodeType fallbackType)
    {
        var node = tree.Nodes.FirstOrDefault(n => n.ProcessNodeId == nodeId);
        return new IntegrationNodeRef
        {
            Id = nodeId,
            Code = node?.Code ?? string.Empty,
            Name = node?.Name ?? fallbackName,
            Type = node?.NodeType ?? fallbackType
        };
    }

    public static IntegrationProcessStatusResponse BuildStatus(ProcessInstanceResponse process, ProcessTypeResponse tree)
    {
        var current = process.CurrentNodeId;
        var terminal = IsTerminal(process.Status);

        var filled = process.FieldValues
            .Where(v => !string.IsNullOrWhiteSpace(v.Value))
            .Select(v => v.FieldDefinitionId)
            .ToHashSet();
        var pending = terminal ? [] : tree.Fields
            .Where(f => f.ProcessNodeId == current && f.IsRequired && !filled.Contains(f.FieldDefinitionId))
            .OrderBy(f => f.DisplayOrder)
            .Select(f => new IntegrationFieldRef
            {
                FieldDefinitionId = f.FieldDefinitionId,
                Code = f.Code,
                Name = string.IsNullOrWhiteSpace(f.CustomLabel) ? f.Name : f.CustomLabel!,
                Type = f.Type,
                Options = f.GlobalOptionsJson
            })
            .DistinctBy(f => f.FieldDefinitionId)
            .ToList();

        var advance = terminal ? [] : tree.Transitions
            .Where(t => t.FromNodeId == current && t.AllowAdvance)
            .Select(t => NodeRef(tree, t.ToNodeId, t.ToNodeName, ProcessNodeType.StandardStage))
            .DistinctBy(n => n.Id)
            .ToList();

        var returns = terminal ? [] : tree.Transitions
            .Where(t => t.ToNodeId == current && t.AllowReturn)
            .Select(t => NodeRef(tree, t.FromNodeId, t.FromNodeName, ProcessNodeType.StandardStage))
            .DistinctBy(n => n.Id)
            .ToList();
        // Sem transição de retorno explícita, o Sicou devolve para a etapa inicial.
        if (!terminal && returns.Count == 0 && tree.StartNodeId.HasValue && tree.StartNodeId != current)
            returns.Add(NodeRef(tree, tree.StartNodeId.Value, tree.StartNodeName ?? "Etapa inicial", ProcessNodeType.StartConfection));

        var actions = new List<string>();
        if (!terminal)
        {
            switch (process.Status)
            {
                case ProcessStatus.Draft:
                    actions.AddRange(["updateDraft", "submit", "comment", "cancel"]);
                    break;
                case ProcessStatus.Returned:
                    actions.Add("submit");
                    if (process.CanManipulate)
                    {
                        if (advance.Count > 0) actions.Add("advance");
                        actions.AddRange(["return", "restart"]);
                    }
                    actions.AddRange(["comment", "cancel", "transfer"]);
                    break;
                default:
                    if (process.CanManipulate)
                    {
                        if (advance.Count > 0) actions.Add("advance");
                        actions.AddRange(["return", "restart"]);
                    }
                    actions.AddRange(["comment", "cancel", "transfer"]);
                    break;
            }
        }

        return new IntegrationProcessStatusResponse
        {
            Id = process.Id,
            ProcessNumber = process.ProcessNumber,
            Title = process.Title,
            Status = process.Status,
            StatusLabel = StatusLabels.GetValueOrDefault(process.Status, process.Status.ToString()),
            IsTerminal = terminal,
            WorkflowId = process.ProcessTypeId,
            WorkflowName = process.ProcessTypeName,
            WorkflowVersion = process.ProcessTypeVersion,
            AreaId = process.AreaId,
            AreaName = process.AreaName,
            CurrentNode = NodeRef(tree, current, process.CurrentNodeName, process.CurrentNodeType),
            OriginUnitId = process.OriginUnitId,
            OriginUnitName = process.OriginUnitName,
            CurrentUnitId = process.CurrentUnitId,
            CurrentUnitName = process.CurrentUnitName,
            ResponsibleUserId = process.ResponsibleUserId,
            CanManipulate = process.CanManipulate && !terminal,
            CreatedAt = process.CreatedAt,
            OpenedAt = process.OpenedAt,
            UpdatedAt = process.UpdatedAt,
            LastEvent = process.History.OrderByDescending(h => h.CreatedAt).FirstOrDefault(),
            PendingRequiredFields = pending,
            AdvanceTargets = advance,
            ReturnTargets = returns,
            AvailableActions = actions
        };
    }
}
