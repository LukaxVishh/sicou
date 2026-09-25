using System.ComponentModel.DataAnnotations;
using Sicou.Domain.Enums;

namespace Sicou.Application.Requests.Workflows;

public class CreateFieldDefinitionRequest
{
    [Required(ErrorMessage = "O código do campo é obrigatório.")]
    [MaxLength(100)]
    public string Code { get; set; } = string.Empty;

    [Required(ErrorMessage = "O nome do campo é obrigatório.")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(200)]
    public string? Placeholder { get; set; }

    public FieldType Type { get; set; } = FieldType.Text;

    public string? GlobalOptionsJson { get; set; }
}

public class UpdateFieldDefinitionRequest
{
    [Required(ErrorMessage = "O nome do campo é obrigatório.")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(200)]
    public string? Placeholder { get; set; }

    public FieldType Type { get; set; }

    public string? GlobalOptionsJson { get; set; }

    public bool IsActive { get; set; } = true;
}
