namespace Sicou.Application.Requests.Users;

public class CreateUserRequest
{
    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public Guid? CompanyId { get; set; }

    public Guid? UnitId { get; set; }

    public List<string> Roles { get; set; } = [];
}