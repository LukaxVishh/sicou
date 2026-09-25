using Sicou.Domain.Enums;

namespace Sicou.Application.Responses.Workflows;

public class ProcessInstanceResponse
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public Guid AreaId { get; set; }
    public string AreaName { get; set; } = string.Empty;
    public Guid ProcessTypeId { get; set; }
    public string ProcessTypeName { get; set; } = string.Empty;
    public int ProcessTypeVersion { get; set; }
    public Guid CurrentNodeId { get; set; }
    public string CurrentNodeName { get; set; } = string.Empty;
    public ProcessNodeType CurrentNodeType { get; set; }
    public string ProcessNumber { get; set; } = string.Empty;
    public string? Title { get; set; }
    public ProcessStatus Status { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public string? CreatedByUserName { get; set; }
    public Guid? OriginUnitId { get; set; }
    public string? OriginUnitName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<ProcessFieldValueResponse> FieldValues { get; set; } = new();
    public List<ProcessHistoryResponse> History { get; set; } = new();
}

public class ProcessFieldValueResponse
{
    public Guid FieldDefinitionId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public FieldType Type { get; set; }
    public string? Value { get; set; }
}

public class ProcessHistoryResponse
{
    public Guid Id { get; set; }
    public Guid? FromNodeId { get; set; }
    public string? FromNodeName { get; set; }
    public Guid? ToNodeId { get; set; }
    public string? ToNodeName { get; set; }
    public ProcessActionType Action { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string? UserFullName { get; set; }
    public string? Observations { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ProcessInstanceSummaryResponse
{
    public Guid Id { get; set; }
    public string ProcessNumber { get; set; } = string.Empty;
    public string? Title { get; set; }
    public Guid ProcessTypeId { get; set; }
    public string ProcessTypeName { get; set; } = string.Empty;
    public Guid CurrentNodeId { get; set; }
    public string CurrentNodeName { get; set; } = string.Empty;
    public ProcessStatus Status { get; set; }
    public string CreatedByUserId { get; set; } = string.Empty;
    public string? CreatedByUserName { get; set; }
    public string? OriginUnitName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
