using Sicou.Domain.Enums;

namespace Sicou.Application.Responses.Workflows;

public class FieldDefinitionResponse
{
    public Guid Id { get; set; }
    public Guid AreaId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Placeholder { get; set; }
    public FieldType Type { get; set; }
    public string? GlobalOptionsJson { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
