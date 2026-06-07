namespace Sicou.Application.Requests.Users;

public class UpdateUserRequest
{
    public string FullName { get; set; } = string.Empty;

    public Guid? CompanyId { get; set; }

    public Guid? UnitId { get; set; }

    public bool IsActive { get; set; } = true;
}