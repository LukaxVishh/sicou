namespace Sicou.Application.Requests.Companies;

public class CreateCompanyRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Document { get; set; }
}