using Microsoft.AspNetCore.Identity;

namespace Sicou.Infrastructure.Identity;

public class ApplicationUser : IdentityUser<Guid>
{
    public string FullName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public Guid? CompanyId { get; set; }

    public Guid? UnitId { get; set; }

    public bool MustChangePassword { get; set; }
    public DateTime? TemporaryPasswordExpiresAt { get; set; }
    public Guid? PasswordRecoveryByUserId { get; set; }
    public DateTime? PasswordRecoveryAt { get; set; }
    public string? EmailPasswordResetTokenHash { get; set; }
    public DateTime? EmailPasswordResetExpiresAt { get; set; }
}
