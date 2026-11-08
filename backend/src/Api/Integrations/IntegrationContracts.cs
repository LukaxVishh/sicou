using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Enums;

namespace Sicou.Api.Integrations;

/// <summary>
/// Valores de campos do processo. A chave pode ser o <b>código</b> do campo (ex.: <c>CPF_CANDIDATO</c>, sem diferenciar
/// maiúsculas) ou o <b>ID</b> da definição do campo. Valores são gravados como texto, como na interface web:
/// números e booleanos viram texto (<c>"10.5"</c>, <c>"true"</c>) e listas viram valores separados por vírgula
/// (múltipla seleção). Datas devem usar <c>AAAA-MM-DD</c>.
/// </summary>
public class IntegrationFieldValues : Dictionary<string, JsonElement>
{
    public IntegrationFieldValues() : base(StringComparer.OrdinalIgnoreCase) { }
}

/// <summary>Abertura de processo a partir de um workflow homologado.</summary>
public class IntegrationCreateProcessRequest
{
    /// <summary>ID do workflow (tipo de processo) obtido em <c>GET /workflows</c>.</summary>
    [Required(ErrorMessage = "Informe o workflowId.")]
    public Guid? WorkflowId { get; set; }

    /// <summary>Título opcional; se vazio, o Sicou usa "Nome do workflow - número".</summary>
    [MaxLength(200)]
    public string? Title { get; set; }

    /// <summary>Unidade de origem da empresa. Vazio = sede. Obrigatório em workflows restritos a unidades.</summary>
    public Guid? OriginUnitId { get; set; }

    /// <summary>
    /// <c>true</c> (padrão) protocola imediatamente: valida os campos obrigatórios da etapa inicial e envia o processo
    /// para a primeira etapa de análise, de forma atômica. <c>false</c> cria somente um rascunho.
    /// </summary>
    public bool Submit { get; set; } = true;

    /// <summary>Observação registrada no histórico ao protocolar.</summary>
    [MaxLength(2000)]
    public string? Observations { get; set; }

    public IntegrationFieldValues Fields { get; set; } = new();
}

/// <summary>Atualização de rascunho.</summary>
public class IntegrationUpdateDraftRequest
{
    [MaxLength(200)]
    public string? Title { get; set; }

    public Guid? OriginUnitId { get; set; }

    public IntegrationFieldValues Fields { get; set; } = new();
}

/// <summary>Protocolo (envio) de um rascunho ou de um processo devolvido.</summary>
public class IntegrationSubmitRequest
{
    [MaxLength(200)]
    public string? Title { get; set; }

    [MaxLength(2000)]
    public string? Observations { get; set; }

    public IntegrationFieldValues Fields { get; set; } = new();
}

/// <summary>Avanço para a próxima etapa ("passar para frente").</summary>
public class IntegrationAdvanceRequest
{
    /// <summary>Etapa de destino por ID. Opcional quando há uma única saída; consulte <c>GET /processes/{id}/status</c>.</summary>
    public Guid? TargetNodeId { get; set; }

    /// <summary>Etapa de destino por código (alternativa ao ID).</summary>
    [MaxLength(100)]
    public string? TargetNodeCode { get; set; }

    /// <summary>Parecer/observação. Obrigatório quando o destino reprova/indefere e não há campo de motivo preenchido.</summary>
    [MaxLength(2000)]
    public string? Observations { get; set; }

    /// <summary>Campos da etapa atual a preencher antes de avançar.</summary>
    public IntegrationFieldValues Fields { get; set; } = new();
}

/// <summary>Devolução para uma etapa anterior ("retornar").</summary>
public class IntegrationReturnRequest
{
    public Guid? TargetNodeId { get; set; }

    [MaxLength(100)]
    public string? TargetNodeCode { get; set; }

    /// <summary>Justificativa da devolução (obrigatória).</summary>
    [Required(ErrorMessage = "A justificativa da devolução é obrigatória.")]
    [MaxLength(2000)]
    public string Observations { get; set; } = string.Empty;
}

/// <summary>Reinício do fluxo a partir da etapa inicial.</summary>
public class IntegrationRestartRequest
{
    [Required(ErrorMessage = "A justificativa do reinício é obrigatória.")]
    [MaxLength(2000)]
    public string Observations { get; set; } = string.Empty;
}

/// <summary>Parecer/observação sem movimentar o processo.</summary>
public class IntegrationCommentRequest
{
    [Required(ErrorMessage = "O parecer/observação é obrigatório.")]
    [MaxLength(2000)]
    public string Observations { get; set; } = string.Empty;
}

/// <summary>Cancelamento administrativo.</summary>
public class IntegrationCancelRequest
{
    [Required(ErrorMessage = "A justificativa do cancelamento é obrigatória.")]
    [StringLength(2000, MinimumLength = 5, ErrorMessage = "A justificativa deve ter de 5 a 2000 caracteres.")]
    public string Reason { get; set; } = string.Empty;
}

/// <summary>Transferência do processo para outra unidade da mesma empresa.</summary>
public class IntegrationTransferRequest
{
    /// <summary>Unidade de destino por ID (preferencial).</summary>
    public Guid? DestinationUnitId { get; set; }

    /// <summary>Unidade de destino por nome, quando o ID não é conhecido.</summary>
    [MaxLength(200)]
    public string? DestinationUnitName { get; set; }

    [Required(ErrorMessage = "O motivo da transferência é obrigatório.")]
    [StringLength(2000, MinimumLength = 5, ErrorMessage = "O motivo deve ter de 5 a 2000 caracteres.")]
    public string Observations { get; set; } = string.Empty;
}

/// <summary>Filtros da listagem de processos.</summary>
public class IntegrationProcessQuery
{
    /// <summary><c>true</c>: somente processos abertos por esta integração.</summary>
    public bool Mine { get; set; }

    /// <summary>Setor (área) da empresa.</summary>
    public Guid? AreaId { get; set; }

    public ProcessStatus? Status { get; set; }

    /// <summary>Busca por número, título ou tipo do processo.</summary>
    [MaxLength(200)]
    public string? Search { get; set; }

    public Guid? UnitId { get; set; }

    /// <summary>Criação a partir desta data (UTC, AAAA-MM-DD).</summary>
    public DateTime? StartDate { get; set; }

    /// <summary>Criação até esta data, inclusive (UTC, AAAA-MM-DD).</summary>
    public DateTime? EndDate { get; set; }

    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(1, 200)]
    public int PageSize { get; set; } = 50;
}

public class IntegrationPage<T>
{
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<T> Items { get; set; } = new();
}

/// <summary>Integração autenticada na chamada.</summary>
public class IntegrationWhoAmIResponse
{
    public Guid IntegrationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ExternalSystem { get; set; } = string.Empty;
    public Guid CompanyId { get; set; }
    public List<string> Scopes { get; set; } = new();
}

public class IntegrationNodeRef
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ProcessNodeType Type { get; set; }
}

public class IntegrationFieldRef
{
    public Guid FieldDefinitionId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public FieldType Type { get; set; }
    public string? Options { get; set; }
}

/// <summary>
/// Situação resumida do processo, pensada para agentes decidirem o próximo passo.
/// <c>availableActions</c> é uma indicação calculada pelo estado e pela árvore; o servidor revalida
/// as regras do fluxo em toda ação.
/// </summary>
public class IntegrationProcessStatusResponse
{
    public Guid Id { get; set; }
    public string ProcessNumber { get; set; } = string.Empty;
    public string? Title { get; set; }
    public ProcessStatus Status { get; set; }
    public string StatusLabel { get; set; } = string.Empty;
    public bool IsTerminal { get; set; }
    public Guid WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public int WorkflowVersion { get; set; }
    public Guid AreaId { get; set; }
    public string AreaName { get; set; } = string.Empty;
    public IntegrationNodeRef CurrentNode { get; set; } = new();
    public Guid? OriginUnitId { get; set; }
    public string? OriginUnitName { get; set; }
    public Guid? CurrentUnitId { get; set; }
    public string? CurrentUnitName { get; set; }
    public Guid? ResponsibleUserId { get; set; }

    /// <summary>A integração pode tramitar o processo (processo em andamento e escopo <c>processes:move</c>).</summary>
    public bool CanManipulate { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? OpenedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public ProcessHistoryResponse? LastEvent { get; set; }

    /// <summary>Campos obrigatórios da etapa atual ainda sem valor.</summary>
    public List<IntegrationFieldRef> PendingRequiredFields { get; set; } = new();

    /// <summary>Etapas para as quais é possível avançar.</summary>
    public List<IntegrationNodeRef> AdvanceTargets { get; set; } = new();

    /// <summary>Etapas para as quais é possível devolver.</summary>
    public List<IntegrationNodeRef> ReturnTargets { get; set; } = new();

    /// <summary>Ações coerentes com o estado: updateDraft, submit, advance, return, restart, comment, cancel, transfer.</summary>
    public List<string> AvailableActions { get; set; } = new();
}
