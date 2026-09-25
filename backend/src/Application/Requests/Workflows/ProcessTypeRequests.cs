using System.ComponentModel.DataAnnotations;
using Sicou.Domain.Enums;

namespace Sicou.Application.Requests.Workflows;

public class CreateProcessTypeRequest
{
    [Required(ErrorMessage = "O código do processo é obrigatório.")]
    [MaxLength(100)]
    public string Code { get; set; } = string.Empty;

    [Required(ErrorMessage = "O nome do processo é obrigatório.")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public ProcessAudience TargetAudience { get; set; } = ProcessAudience.All;

    public Guid? StartNodeId { get; set; }
}

public class UpdateProcessTypeRequest
{
    [Required(ErrorMessage = "O nome do processo é obrigatório.")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public ProcessAudience TargetAudience { get; set; }

    public Guid? StartNodeId { get; set; }

    public List<ProcessTypeNodeInput> Nodes { get; set; } = new();

    public List<ProcessTypeFieldInput> Fields { get; set; } = new();

    public List<ProcessTransitionInput> Transitions { get; set; } = new();
}

public class ProcessTypeNodeInput
{
    public Guid ProcessNodeId { get; set; }
    public int Order { get; set; } = 1;
    public string? Instructions { get; set; }
}

public class ProcessTypeFieldInput
{
    public Guid FieldDefinitionId { get; set; }
    public Guid? ProcessNodeId { get; set; }
    public bool IsRequired { get; set; }
    public int DisplayOrder { get; set; } = 1;
    public string? CustomLabel { get; set; }
    public string? HelpText { get; set; }
    public string? ConditionsJson { get; set; }
}

public class ProcessTransitionInput
{
    public Guid FromNodeId { get; set; }
    public Guid ToNodeId { get; set; }
    public bool AllowAdvance { get; set; } = true;
    public bool AllowReturn { get; set; } = true;
    public bool AllowRestart { get; set; } = true;
}
