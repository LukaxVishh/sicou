using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Auth;

namespace Sicou.Api.Controllers;

[ApiController, AllowAnonymous, Route("api/auth")]
[EnableRateLimiting("email-password-recovery")]
public class EmailPasswordRecoveryController(IEmailPasswordRecoveryService service) : ControllerBase
{
    [HttpPost("forgot-password")]
    public async Task<IActionResult> Forgot([FromBody] ForgotPasswordRequest request)
    {
        Response.Headers.CacheControl = "no-store";
        await service.RequestAsync(request.Email);
        return Ok(new { message = "Se houver uma conta ativa com esse e-mail, você receberá um link para recuperar a senha." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> Reset([FromBody] ResetPasswordRequest request)
    {
        Response.Headers.CacheControl = "no-store";
        await service.ResetAsync(request);
        return Ok(new { message = "Senha atualizada. Faça login com sua nova senha." });
    }
}
