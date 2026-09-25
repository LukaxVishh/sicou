using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class ProcessTypeField : BaseEntity
{
    public Guid ProcessTypeId { get; set; }
    public ProcessType ProcessType { get; set; } = null!;

    public Guid? ProcessNodeId { get; set; }
    public ProcessNode? ProcessNode { get; set; }

    public Guid FieldDefinitionId { get; set; }
    public FieldDefinition FieldDefinition { get; set; } = null!;

    public bool IsRequired { get; set; } = false;
    public int DisplayOrder { get; set; } = 1;

    public string? CustomLabel { get; set; }
    public string? HelpText { get; set; }

    /// <summary>
    /// JSON contendo as regras condicionais deste campo:
    /// Exemplo: [{"sourceFieldId":"...","operator":"Equals","expectedValue":"Sim","action":"Show","targetFieldIds":["..."]}]
    /// </summary>
    public string? ConditionsJson { get; set; }
}
