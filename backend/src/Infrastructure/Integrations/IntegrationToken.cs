namespace Sicou.Infrastructure.Integrations;

public class IntegrationToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? CompanyId { get; set; }
    public Guid? UnitId { get; set; }
    public string Name { get; set; } = "";
    public string ExternalSystem { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public string SecurityStamp { get; set; } = "";
    public string Scopes { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public class IntegrationCall
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TokenId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Method { get; set; } = "";
    public string Route { get; set; } = "";
    public int StatusCode { get; set; }
    public long DurationMs { get; set; }
}
