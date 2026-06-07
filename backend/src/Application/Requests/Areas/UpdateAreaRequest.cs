namespace Sicou.Application.Requests.Areas;

public class UpdateAreaRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
}