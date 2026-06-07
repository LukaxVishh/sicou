namespace Sicou.Application.Requests.Companies;

public class UpdateCompanyRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Document { get; set; }

    public bool IsActive { get; set; } = true;
}