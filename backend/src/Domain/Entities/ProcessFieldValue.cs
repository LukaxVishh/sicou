using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class ProcessFieldValue : BaseEntity
{
    public Guid ProcessInstanceId { get; set; }
    public ProcessInstance ProcessInstance { get; set; } = null!;

    public Guid FieldDefinitionId { get; set; }
    public FieldDefinition FieldDefinition { get; set; } = null!;

    public string? Value { get; set; }
}
