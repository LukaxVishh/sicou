using System.ComponentModel.DataAnnotations;

namespace Sicou.Application.Requests.Workflows;

public class CreateProcessInstanceRequest
{
    [Required(ErrorMessage = "O tipo de processo é obrigatório.")]
    public Guid ProcessTypeId { get; set; }

    [MaxLength(200)]
    public string? Title { get; set; }

    public Guid? OriginUnitId { get; set; }

    public bool IsDraft { get; set; } = true;

    public Dictionary<Guid, string?> InitialFieldValues { get; set; } = new();
}

public class UpdateProcessDraftRequest
{
    [MaxLength(200)]
    public string? Title { get; set; }

    public Guid? OriginUnitId { get; set; }

    public Dictionary<Guid, string?> FieldValues { get; set; } = new();
}

public class ProtocolProcessRequest
{
    [MaxLength(200)]
    public string? Title { get; set; }

    public Dictionary<Guid, string?> FieldValues { get; set; } = new();

    [MaxLength(2000)]
    public string? Observations { get; set; }
}

public class AdvanceProcessRequest
{
    public Guid? TargetNodeId { get; set; }

    [MaxLength(2000)]
    public string? Observations { get; set; }

    public Dictionary<Guid, string?> FieldValues { get; set; } = new();
}

public class ReturnProcessRequest
{
    public Guid? TargetNodeId { get; set; }

    [Required(ErrorMessage = "A justificativa para devolução é obrigatória.")]
    [MaxLength(2000)]
    public string Observations { get; set; } = string.Empty;
}

public class RestartProcessRequest
{
    [Required(ErrorMessage = "A justificativa para reinício é obrigatória.")]
    [MaxLength(2000)]
    public string Observations { get; set; } = string.Empty;
}

public class AddProcessCommentRequest
{
    [Required(ErrorMessage = "O parecer/observação é obrigatório.")]
    [MaxLength(2000)]
    public string Observations { get; set; } = string.Empty;
}

public class CancelProcessRequest
{
    [Required(ErrorMessage = "A justificativa do cancelamento é obrigatória.")]
    [MinLength(5, ErrorMessage = "A justificativa deve conter pelo menos 5 caracteres.")]
    [MaxLength(2000)]
    public string Reason { get; set; } = string.Empty;
}

public class TransferProcessRequest
{
    public Guid? DestinationUnitId { get; set; }

    [MaxLength(200)]
    public string? DestinationUnitName { get; set; }

    [Required(ErrorMessage = "A justificativa / motivo da transferência é obrigatória.")]
    [MinLength(5, ErrorMessage = "O motivo da transferência deve conter pelo menos 5 caracteres.")]
    [MaxLength(2000)]
    public string Observations { get; set; } = string.Empty;
}

public class ProcessSearchFilterRequest
{
    public Guid? AreaId { get; set; }
    public string? SearchTerm { get; set; }
    public Guid? UnitId { get; set; }
    public string? UnitName { get; set; }
    public Sicou.Domain.Enums.ProcessStatus? Status { get; set; }
    public string? Creator { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}

