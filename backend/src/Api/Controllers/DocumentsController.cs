using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Domain.Constants;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;
using Sicou.Infrastructure.Services;

namespace Sicou.Api.Controllers;

[ApiController, Authorize, Route("api/documents")]
public class DocumentsController(DocumentProcessingService processor, UserManager<ApplicationUser> users,
    ICurrentUserService current, ApplicationDbContext db) : ControllerBase
{
    private static readonly SemaphoreSlim Capacity = new(2);

    [HttpPost("process"), RequestSizeLimit(DocumentProcessingService.MaxBytes + 65536)]
    public async Task<IActionResult> Process(IFormFile file, CancellationToken ct)
    {
        var actor = await users.FindByIdAsync(current.UserId ?? "");
        if (actor is not { IsActive: true }) return Forbid();
        if (!await users.IsInRoleAsync(actor, SystemRoles.SuperAdmin)
            && !await db.Companies.AnyAsync(c => c.Id == actor.CompanyId && c.IsActive, ct)) return Forbid();
        if (file.Length is 0 or > DocumentProcessingService.MaxBytes) return BadRequest(new { message = "Envie um arquivo de até 10 MB." });
        if (!await Capacity.WaitAsync(0, ct)) return StatusCode(429, new { message = "Processamento ocupado. Tente novamente em instantes." });
        try
        {
            using var input = new MemoryStream();
            await file.CopyToAsync(input, ct);
            Response.Headers.CacheControl = "no-store";
            return Ok(processor.Process(input.ToArray(), file.FileName, ct));
        }
        finally { Capacity.Release(); }
    }
}
