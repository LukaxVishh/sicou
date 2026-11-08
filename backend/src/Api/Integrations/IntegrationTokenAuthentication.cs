using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Sicou.Application.Interfaces.Services;
using Sicou.Domain.Constants;

namespace Sicou.Api.Integrations;

public static class IntegrationAuth
{
    public const string Scheme = "IntegrationToken";
    public const string ScopeClaim = "scope";
    public const string TokenIdClaim = "integration_token_id";
    public const string CompanyClaim = "integration_company_id";
    public const string NameClaim = "integration_name";
    public const string ExternalSystemClaim = "integration_external_system";
    public const string PolicyPrefix = "integration-scope:";
    public const string RoutePrefix = "/api/integrations/v1";
    public const string RateLimitPolicy = "integration-tokens";
}

/// <summary>
/// Autentica <c>Authorization: Bearer sic_...</c>. O segredo é validado a cada requisição (UC-020, passo 4).
/// O principal representa a integração (sem usuário): identificador, nome, empresa e escopos.
/// </summary>
public class IntegrationTokenAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IIntegrationTokenService tokens) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    private const string FailureItem = "IntegrationAuthFailure";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        string? header = Request.Headers.Authorization;
        if (string.IsNullOrWhiteSpace(header))
            return Fail("Envie o token de integração no cabeçalho Authorization: Bearer sic_...");

        var secret = header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? header[7..].Trim() : header.Trim();
        if (!secret.StartsWith("sic_", StringComparison.Ordinal))
            return Fail("Esta API aceita somente tokens de integração (sic_...). O JWT de sessão não é aceito aqui.");

        var identity = await tokens.ValidateAsync(secret, Context.RequestAborted);
        if (identity is null)
            return Fail("Token de integração inválido, expirado ou revogado. Solicite a renovação ao administrador.");

        var claims = new List<Claim>
        {
            new(IntegrationAuth.TokenIdClaim, identity.TokenId.ToString()),
            new(IntegrationAuth.CompanyClaim, identity.CompanyId.ToString()),
            new(IntegrationAuth.NameClaim, identity.Name),
            new(IntegrationAuth.ExternalSystemClaim, identity.ExternalSystem),
            new(ClaimTypes.Name, identity.ActorName)
        };
        claims.AddRange(identity.Scopes.Select(s => new Claim(IntegrationAuth.ScopeClaim, s)));

        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, IntegrationAuth.Scheme));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, IntegrationAuth.Scheme));
    }

    private AuthenticateResult Fail(string message)
    {
        Context.Items[FailureItem] = message;
        return AuthenticateResult.Fail(message);
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.Headers.WWWAuthenticate = $"Bearer realm=\"sicou-integrations\", error=\"invalid_token\"";
        var message = Context.Items[FailureItem] as string ?? "Token de integração ausente ou inválido.";
        await Response.WriteAsJsonAsync(new { message, statusCode = 401 });
    }

    protected override async Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        var required = Context.GetEndpoint()?.Metadata.GetOrderedMetadata<RequireScopeAttribute>()
            .Select(a => a.Scope).Distinct().ToList() ?? [];
        var message = required.Count > 0
            ? $"Escopo insuficiente. Esta operação exige o escopo '{string.Join("', '", required)}'."
            : "Permissão negada para o recurso solicitado.";
        await Response.WriteAsJsonAsync(new { message, statusCode = 403, requiredScopes = required });
    }
}

/// <summary>Exige um escopo do token de integração. Autentica somente pelo esquema de integração.</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public sealed class RequireScopeAttribute : AuthorizeAttribute
{
    public RequireScopeAttribute(string scope)
    {
        Scope = scope;
        Policy = IntegrationAuth.PolicyPrefix + scope;
        AuthenticationSchemes = IntegrationAuth.Scheme;
    }

    public string Scope { get; }
}

public static class IntegrationAuthExtensions
{
    /// <summary>Reconstrói a integração autenticada a partir das claims da requisição.</summary>
    public static Sicou.Application.Responses.Integrations.IntegrationIdentity ToIntegration(this ClaimsPrincipal user)
        => new(
            Guid.Parse(user.FindFirstValue(IntegrationAuth.TokenIdClaim)!),
            user.FindFirstValue(IntegrationAuth.NameClaim) ?? string.Empty,
            user.FindFirstValue(IntegrationAuth.ExternalSystemClaim) ?? string.Empty,
            Guid.Parse(user.FindFirstValue(IntegrationAuth.CompanyClaim)!),
            user.FindAll(IntegrationAuth.ScopeClaim).Select(c => c.Value).ToList());

    public static AuthenticationBuilder AddIntegrationTokens(this AuthenticationBuilder builder)
        => builder.AddScheme<AuthenticationSchemeOptions, IntegrationTokenAuthenticationHandler>(IntegrationAuth.Scheme, null);

    public static void AddIntegrationScopePolicies(this AuthorizationOptions options)
    {
        foreach (var scope in IntegrationScopes.All)
        {
            options.AddPolicy(IntegrationAuth.PolicyPrefix + scope, policy => policy
                .AddAuthenticationSchemes(IntegrationAuth.Scheme)
                .RequireAuthenticatedUser()
                .RequireClaim(IntegrationAuth.ScopeClaim, scope));
        }
    }
}
