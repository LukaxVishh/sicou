using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Sicou.Domain.Constants;
using Sicou.Infrastructure.Identity;

namespace Sicou.Api.Controllers;

[ApiController]
[Route("api/admin-setup")]
public class AdminSetupController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;

    public AdminSetupController(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    [HttpPost("promote-super-admin")]
    public async Task<IActionResult> PromoteSuperAdmin([FromQuery] string email)
    {
        var user = await _userManager.FindByEmailAsync(email);

        if (user is null)
        {
            return NotFound(new
            {
                message = "Usuário não encontrado."
            });
        }

        var alreadyInRole = await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin);

        if (alreadyInRole)
        {
            return Ok(new
            {
                message = "Usuário já é SUPER_ADMIN."
            });
        }

        var result = await _userManager.AddToRoleAsync(user, SystemRoles.SuperAdmin);

        if (!result.Succeeded)
        {
            return BadRequest(new
            {
                message = "Erro ao atribuir role.",
                errors = result.Errors.Select(e => e.Description)
            });
        }

        return Ok(new
        {
            message = "Usuário promovido para SUPER_ADMIN com sucesso.",
            userId = user.Id,
            email = user.Email,
            role = SystemRoles.SuperAdmin
        });
    }
}