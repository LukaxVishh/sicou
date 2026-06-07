namespace Sicou.Application.Requests.Units;

public class UpdateUnitRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? City { get; set; }

    public string? State { get; set; }

    public bool IsActive { get; set; } = true;
}