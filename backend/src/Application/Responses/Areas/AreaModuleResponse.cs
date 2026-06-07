using Sicou.Domain.Enums;

namespace Sicou.Application.Responses.Areas;

public class AreaModuleResponse
{
    public Guid ModuleId { get; set; }

    public ModuleCode Code { get; set; }

    public string Name { get; set; } = string.Empty;

    public bool Enabled { get; set; }
}