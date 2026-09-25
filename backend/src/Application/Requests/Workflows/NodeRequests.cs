using System.ComponentModel.DataAnnotations;
using Sicou.Domain.Enums;

namespace Sicou.Application.Requests.Workflows;

public class CreateProcessNodeRequest
{
    [Required(ErrorMessage = "O código do local é obrigatório.")]
    [MaxLength(100)]
    public string Code { get; set; } = string.Empty;

    [Required(ErrorMessage = "O nome do local de processo é obrigatório.")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public ProcessNodeType NodeType { get; set; } = ProcessNodeType.StandardStage;
}

public class UpdateProcessNodeRequest
{
    [Required(ErrorMessage = "O nome do local de processo é obrigatório.")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public ProcessNodeType NodeType { get; set; }

    public bool IsActive { get; set; } = true;
}
