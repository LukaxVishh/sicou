using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Domain.Constants;

namespace Sicou.Api.Controllers;

[ApiController, Route("api/password-recovery")]
[Authorize(Roles = $"{SystemRoles.SuperAdmin},{SystemRoles.CompanyAdmin}")]
public class PasswordRecoveryController(IPasswordRecoveryService service) : ControllerBase
{
    [HttpGet("users")]
    public async Task<IActionResult> Users() => Ok(await service.GetEligibleUsersAsync());

    [HttpPost("users/{id:guid}/temporary-password")]
    public async Task<IActionResult> Generate(Guid id)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await service.GenerateAsync(id));
    }
}
