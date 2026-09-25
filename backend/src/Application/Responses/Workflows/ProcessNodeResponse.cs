using Sicou.Domain.Enums;

namespace Sicou.Application.Responses.Workflows;

public class ProcessNodeResponse
{
    public Guid Id { get; set; }
    public Guid AreaId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProcessNodeType NodeType { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
