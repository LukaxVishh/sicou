using System.ComponentModel.DataAnnotations;

namespace Sicou.Application.Requests.Auth;

public class ChangePasswordRequest
{
    [Required] public string CurrentPassword { get; set; } = string.Empty;
    [Required, MinLength(8)] public string NewPassword { get; set; } = string.Empty;
}
