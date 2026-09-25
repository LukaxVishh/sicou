using Sicou.Domain.Enums;

namespace Sicou.Application.Responses.Workflows;

public class ProcessTypeResponse
{
    public Guid Id { get; set; }
    public Guid AreaId { get; set; }
    public string AreaName { get; set; } = string.Empty;
    public Guid FamilyId { get; set; }
    public int VersionNumber { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProcessAudience TargetAudience { get; set; }
    public ProcessTypeStatus Status { get; set; }
    public Guid? StartNodeId { get; set; }
    public string? StartNodeName { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<ProcessTypeNodeResponse> Nodes { get; set; } = new();
    public List<ProcessTypeFieldResponse> Fields { get; set; } = new();
    public List<ProcessTransitionResponse> Transitions { get; set; } = new();
}

public class ProcessTypeNodeResponse
{
    public Guid Id { get; set; }
    public Guid ProcessNodeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public ProcessNodeType NodeType { get; set; }
    public int Order { get; set; }
    public string? Instructions { get; set; }
}

public class ProcessTypeFieldResponse
{
    public Guid Id { get; set; }
    public Guid? ProcessNodeId { get; set; }
    public string? ProcessNodeName { get; set; }
    public Guid FieldDefinitionId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public FieldType Type { get; set; }
    public string? Placeholder { get; set; }
    public string? GlobalOptionsJson { get; set; }
    public bool IsRequired { get; set; }
    public int DisplayOrder { get; set; }
    public string? CustomLabel { get; set; }
    public string? HelpText { get; set; }
    public string? ConditionsJson { get; set; }
}

public class ProcessTransitionResponse
{
    public Guid Id { get; set; }
    public Guid FromNodeId { get; set; }
    public string FromNodeName { get; set; } = string.Empty;
    public Guid ToNodeId { get; set; }
    public string ToNodeName { get; set; } = string.Empty;
    public bool AllowAdvance { get; set; }
    public bool AllowReturn { get; set; }
    public bool AllowRestart { get; set; }
}

public class ProcessTypeSummaryResponse
{
    public Guid Id { get; set; }
    public Guid AreaId { get; set; }
    public string AreaName { get; set; } = string.Empty;
    public Guid FamilyId { get; set; }
    public int VersionNumber { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProcessAudience TargetAudience { get; set; }
    public ProcessTypeStatus Status { get; set; }
    public int NodesCount { get; set; }
    public int FieldsCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
