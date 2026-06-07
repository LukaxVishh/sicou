using Sicou.Domain.Enums;

namespace Sicou.Application.Requests.Areas;

public class UpdateAreaModulesRequest
{
    public List<ModuleCode> ModuleCodes { get; set; } = new();
}