using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sicou.Api.Integrations;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;
using Sicou.Infrastructure.Integrations;

namespace Sicou.Api.Controllers;

public record CreateIntegrationTokenRequest(
    [Required, StringLength(100, MinimumLength = 1)] string Name,
    [Range(1, 365)] int ExpiresInDays,
    [Required, MinLength(1), MaxLength(20)] string[] Scopes,
    [Required, StringLength(100, MinimumLength = 1)] string ExternalSystem);

// Management always requires an interactive session. An API token cannot mint tokens.
[ApiController, Route("api/integrations"), Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class IntegrationTokensController(ApplicationDbContext db, UserManager<ApplicationUser> users) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("scopes")]
    public ActionResult<string[]> Scopes() => IntegrationRoutes.Scopes;

    [HttpGet("tokens")]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await db.Set<IntegrationToken>().AsNoTracking()
        .Where(t => t.UserId == UserId).OrderByDescending(t => t.CreatedAt)
        .Select(t => new { t.Id, t.Name, t.ExternalSystem, t.Scopes, t.CreatedAt, t.ExpiresAt, t.RevokedAt }).ToListAsync(ct));

    [HttpPost("tokens")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(CreateIntegrationTokenRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.ExternalSystem) || request.Scopes.Any(s => !IntegrationRoutes.Scopes.Contains(s)))
            return BadRequest(new { message = "Informe nome, sistema externo e escopos válidos." });
        var user = await users.FindByIdAsync(UserId.ToString());
        if (user is null || !user.IsActive || user.MustChangePassword || string.IsNullOrEmpty(user.SecurityStamp)) return Forbid();
        if (await db.Set<IntegrationToken>().CountAsync(t => t.UserId == UserId && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow, ct) >= 20)
            return BadRequest(new { message = "Revogue um token antes de criar outro (limite de 20 ativos)." });
        var secret = IntegrationTokenSecret.Create();
        var token = new IntegrationToken
        {
            UserId = user.Id, CompanyId = user.CompanyId, UnitId = user.UnitId,
            SecurityStamp = user.SecurityStamp, Name = request.Name.Trim(), ExternalSystem = request.ExternalSystem.Trim(),
            TokenHash = IntegrationTokenSecret.Hash(secret), ExpiresAt = DateTime.UtcNow.AddDays(request.ExpiresInDays),
            Scopes = string.Join(' ', request.Scopes.Distinct().Order())
        };
        db.Add(token);
        await db.SaveChangesAsync(ct);
        return Created($"/api/integrations/tokens/{token.Id}", new { token.Id, token.Name, token.ExternalSystem, token.Scopes, token.ExpiresAt, token = secret });
    }

    [HttpDelete("tokens/{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        var token = await db.Set<IntegrationToken>().SingleOrDefaultAsync(t => t.Id == id && t.UserId == UserId, ct);
        if (token is null) return NotFound();
        token.RevokedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("calls")]
    public async Task<IActionResult> Calls([FromQuery, Range(1, int.MaxValue)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 25, CancellationToken ct = default)
    {
        var query = db.Set<IntegrationCall>().AsNoTracking().Where(c => c.UserId == UserId);
        var since = DateTime.UtcNow.AddDays(-7);
        var recent = query.Where(c => c.CreatedAt >= since);
        return Ok(new
        {
            total = await query.CountAsync(ct),
            lastSevenDays = new { calls = await recent.CountAsync(ct), errors = await recent.CountAsync(c => c.StatusCode >= 400, ct) },
            items = await query.OrderByDescending(c => c.CreatedAt).ThenBy(c => c.Id)
                .Skip((int)Math.Min((long)(page - 1) * pageSize, int.MaxValue)).Take(pageSize)
                .Select(c => new { c.Id, c.TokenId, c.Method, c.Route, c.StatusCode, c.DurationMs, c.CreatedAt }).ToListAsync(ct)
        });
    }
}
