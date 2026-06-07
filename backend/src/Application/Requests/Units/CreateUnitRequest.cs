namespace Sicou.Application.Requests.Units;

public class CreateUnitRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? City { get; set; }

    public string? State { get; set; }
}