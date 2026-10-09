using System.ComponentModel.DataAnnotations;

namespace Sicou.Application.Requests.Auth;

public class ForgotPasswordRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = string.Empty;
    [Required, MaxLength(4096)] public string Token { get; set; } = string.Empty;
    [Required, MinLength(8), MaxLength(128)] public string NewPassword { get; set; } = string.Empty;
}
