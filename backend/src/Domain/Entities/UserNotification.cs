namespace Sicou.Domain.Entities;

public class UserNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? CompanyId { get; set; }
    public Guid? AreaId { get; set; }
    public Guid? ProcessInstanceId { get; set; }
    public string Audience { get; set; } = "area";
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}
