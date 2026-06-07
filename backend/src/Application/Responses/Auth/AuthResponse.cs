namespace Sicou.Application.Responses.Auth;

public class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public UserAuthResponse User { get; set; } = new();
}

public class UserAuthResponse
{
    public Guid Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public Guid? CompanyId { get; set; }

    public Guid? UnitId { get; set; }

    public IList<string> Roles { get; set; } = new List<string>();
}