using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;
using Sicou.Infrastructure.Integrations;

namespace Sicou.Api.Integrations;

public class IntegrationAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
    UrlEncoder encoder, ApplicationDbContext db, UserManager<ApplicationUser> users)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "IntegrationToken";
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return AuthenticateResult.NoResult();
        var secret = header[7..];
        if (!IntegrationTokenSecret.IsWellFormed(secret)) return AuthenticateResult.Fail("Token inválido.");
        var hash = IntegrationTokenSecret.Hash(secret);
        var token = await db.Set<IntegrationToken>().AsNoTracking()
            .SingleOrDefaultAsync(t => t.TokenHash == hash, Context.RequestAborted);
        if (token is null || token.RevokedAt != null || token.ExpiresAt <= DateTime.UtcNow)
            return AuthenticateResult.Fail("Token inválido ou expirado.");
        var user = await users.FindByIdAsync(token.UserId.ToString());
        if (user is null || !user.IsActive || user.MustChangePassword
            || user.SecurityStamp != token.SecurityStamp || user.CompanyId != token.CompanyId || user.UnitId != token.UnitId
            || await users.IsLockedOutAsync(user))
            return AuthenticateResult.Fail("O acesso do proprietário mudou. Crie outro token.");
        // Re-read roles on every call; tokens never freeze or grant user privileges.
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName), new(ClaimTypes.Email, user.Email ?? ""),
            new("integration_token_id", token.Id.ToString())
        };
        claims.AddRange((await users.GetRolesAsync(user)).Select(role => new Claim(ClaimTypes.Role, role)));
        claims.AddRange(token.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(scope => new Claim("integration_scope", scope)));
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName)), SchemeName));
    }
}
