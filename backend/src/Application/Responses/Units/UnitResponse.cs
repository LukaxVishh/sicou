namespace Sicou.Application.Responses.Units;

public class UnitResponse
{
    public Guid Id { get; set; }

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? City { get; set; }

    public string? State { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}