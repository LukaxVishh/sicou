using Sicou.Domain.Enums;

namespace Sicou.Application.Requests.Areas;

public class CreateAreaRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public List<ModuleCode> ModuleCodes { get; set; } = new();
}