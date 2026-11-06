namespace Sicou.Application.Requests.Users;

public class UpdateUserRequest
{
    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public Guid? CompanyId { get; set; }

    public Guid? UnitId { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Na troca de unidade dentro da mesma empresa, recria os acessos de setor na nova unidade (RF-010).</summary>
    public bool CopyAccessesToNewUnit { get; set; }
}