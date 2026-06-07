using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Domain.Constants;

namespace Sicou.Api.Controllers;

[ApiController]
[Route("api/security-test")]
public class SecurityTestController : ControllerBase
{
    [HttpGet("authenticated")]
    [Authorize]
    public IActionResult Authenticated()
    {
        return Ok(new
        {
            message = "Você está autenticado."
        });
    }

    [HttpGet("super-admin")]
    [Authorize(Roles = SystemRoles.SuperAdmin)]
    public IActionResult SuperAdmin()
    {
        return Ok(new
        {
            message = "Você acessou uma rota exclusiva para SUPER_ADMIN."
        });
    }
}