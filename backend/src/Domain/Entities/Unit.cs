using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class Unit : BaseEntity
{
    public Guid CompanyId { get; set; }

    public Company Company { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? City { get; set; }

    public string? State { get; set; }
}