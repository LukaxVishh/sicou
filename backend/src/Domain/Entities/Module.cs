using Sicou.Domain.Common;
using Sicou.Domain.Enums;

namespace Sicou.Domain.Entities;

public class Module : BaseEntity
{
    public ModuleCode Code { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public ICollection<AreaModule> AreaModules { get; set; } = new List<AreaModule>();
}