namespace Sicou.Application.Responses.Companies;

public class CompanyResponse
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Document { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}