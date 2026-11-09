using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Integrations;
using Sicou.Application.Responses.Integrations;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

/// <summary>
/// Cadastro, renovação, revogação, consulta e validação das integrações (RF-023 / UC-020 / RNF-015).
/// A integração pertence a uma empresa e não age em nome de usuário. Gestão: Super Admin, Desenvolvedor
/// ou Admin da Empresa (este, somente na própria empresa).
/// </summary>
public class IntegrationTokenService(
    ApplicationDbContext db,
    UserManager<ApplicationUser> users,
    ICurrentUserService currentUser,
    IConfiguration configuration) : IIntegrationTokenService
{
    public const string SecretPrefix = "sic_";
    public const int MaxActiveTokensPerCompany = 50;
    private static readonly TimeSpan LastUsedPrecision = TimeSpan.FromMinutes(1);

    private int LifetimeDays => Math.Clamp(configuration.GetValue<int?>("Integrations:TokenLifetimeDays") ?? 90, 1, 365);

    public static string HashSecret(string secret)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret))).ToLowerInvariant();

    public static string GenerateSecret()
        => SecretPrefix + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public IReadOnlyList<IntegrationScopeResponse> GetScopes()
        => IntegrationScopes.Descriptions.Select(d => new IntegrationScopeResponse(d.Key, d.Value)).ToList();

    private sealed record Manager(ApplicationUser User, bool IsPlatform);

    private async Task<Manager> ManagerAsync()
    {
        var actor = await users.FindByIdAsync(currentUser.UserId ?? string.Empty);
        if (actor is not { IsActive: true })
            throw new UnauthorizedAccessException("Usuário inativo ou não autenticado.");
        var roles = await users.GetRolesAsync(actor);
        if (SystemRoles.IsPlatformAdmin(roles)) return new Manager(actor, true);
        if (!roles.Contains(SystemRoles.CompanyAdmin))
            throw new UnauthorizedAccessException("Somente Super Admin, Desenvolvedor ou Admin da Empresa podem gerenciar integrações.");
        if (!actor.CompanyId.HasValue || !await db.Companies.AnyAsync(c => c.Id == actor.CompanyId && c.IsActive))
            throw new UnauthorizedAccessException("O administrador precisa estar vinculado a uma empresa ativa.");
        return new Manager(actor, false);
    }

    /// <summary>Super Admin/Desenvolvedor veem todas; Admin da Empresa vê as da própria empresa.</summary>
    private IQueryable<IntegrationToken> Visible(Manager manager)
        => manager.IsPlatform ? db.IntegrationTokens : db.IntegrationTokens.Where(t => t.CompanyId == manager.User.CompanyId);

    public async Task<IReadOnlyList<IntegrationTokenResponse>> GetTokensAsync(Guid? companyId)
    {
        var manager = await ManagerAsync();
        var query = Visible(manager).AsNoTracking();
        if (companyId.HasValue) query = query.Where(t => t.CompanyId == companyId.Value);
        var tokens = await query.OrderByDescending(t => t.CreatedAt).Take(500).ToListAsync();
        return await MapAsync(tokens);
    }

    private async Task<List<IntegrationTokenResponse>> MapAsync(List<IntegrationToken> tokens)
    {
        var companyIds = tokens.Select(t => t.CompanyId).Distinct().ToList();
        var userIds = tokens.Select(t => t.CreatedByUserId).Distinct().ToList();
        var companies = await db.Companies.AsNoTracking().Where(c => companyIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var creators = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName);
        var now = DateTime.UtcNow;
        return tokens.Select(t => Map(t, companies.GetValueOrDefault(t.CompanyId), creators.GetValueOrDefault(t.CreatedByUserId), now,
            new IntegrationTokenResponse())).ToList();
    }

    private static T Map<T>(IntegrationToken t, Company? company, string? creatorName, DateTime now, T response)
        where T : IntegrationTokenResponse
    {
        response.Id = t.Id;
        response.Name = t.Name;
        response.ExternalSystem = t.ExternalSystem;
        response.TokenPrefix = t.TokenPrefix;
        response.CompanyId = t.CompanyId;
        response.CompanyName = company?.Name ?? string.Empty;
        response.CreatedByUserId = t.CreatedByUserId;
        response.CreatedByName = creatorName ?? "Usuário removido";
        response.Scopes = t.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        response.CreatedAt = t.CreatedAt;
        response.ExpiresAt = t.ExpiresAt;
        response.RenewedAt = t.RenewedAt;
        response.RevokedAt = t.RevokedAt;
        response.LastUsedAt = t.LastUsedAt;
        response.Status = t.RevokedAt.HasValue ? "Revoked"
            : t.ExpiresAt <= now ? "Expired"
            : company is not { IsActive: true } ? "Invalidated"
            : "Active";
        return response;
    }

    public async Task<CreatedIntegrationTokenResponse> CreateAsync(CreateIntegrationTokenRequest request)
    {
        var manager = await ManagerAsync();

        var name = (request.Name ?? string.Empty).Trim();
        var externalSystem = (request.ExternalSystem ?? string.Empty).Trim();
        if (name.Length is < 3 or > 100) throw new InvalidOperationException("O nome deve ter entre 3 e 100 caracteres.");
        if (externalSystem.Length is < 2 or > 100) throw new InvalidOperationException("O sistema externo deve ter entre 2 e 100 caracteres.");

        var scopes = (request.Scopes ?? []).Select(s => s.Trim().ToLowerInvariant()).Where(s => s.Length > 0).Distinct().ToList();
        if (scopes.Count == 0) throw new InvalidOperationException("Selecione pelo menos um escopo.");
        var unknown = scopes.Where(s => !IntegrationScopes.IsValid(s)).ToList();
        if (unknown.Count > 0) throw new InvalidOperationException($"Escopo(s) desconhecido(s): {string.Join(", ", unknown)}.");

        Guid companyId;
        if (manager.IsPlatform)
        {
            companyId = request.CompanyId
                ?? throw new InvalidOperationException("Selecione a empresa da integração no seletor corporativo.");
        }
        else
        {
            companyId = manager.User.CompanyId!.Value;
            if (request.CompanyId.HasValue && request.CompanyId != companyId)
                throw new UnauthorizedAccessException("Cadastre integrações apenas para a sua empresa.");
        }
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == companyId && c.IsActive)
            ?? throw new KeyNotFoundException("Empresa não encontrada ou inativa.");

        var now = DateTime.UtcNow;
        var active = await db.IntegrationTokens.CountAsync(t => t.CompanyId == companyId && t.RevokedAt == null && t.ExpiresAt > now);
        if (active >= MaxActiveTokensPerCompany)
            throw new InvalidOperationException($"A empresa já possui {MaxActiveTokensPerCompany} integrações ativas. Revogue alguma antes de cadastrar outra.");

        var secret = GenerateSecret();
        var token = new IntegrationToken
        {
            CompanyId = companyId,
            CreatedByUserId = manager.User.Id,
            Name = name,
            ExternalSystem = externalSystem,
            TokenHash = HashSecret(secret),
            TokenPrefix = secret[..12],
            Scopes = string.Join(' ', scopes),
            CreatedAt = now,
            RenewedAt = now,
            ExpiresAt = now.AddDays(LifetimeDays)
        };
        db.IntegrationTokens.Add(token);
        await db.SaveChangesAsync();

        var response = Map(token, company, manager.User.FullName, now, new CreatedIntegrationTokenResponse());
        response.Token = secret;
        return response;
    }

    public async Task<CreatedIntegrationTokenResponse> RenewAsync(Guid id)
    {
        var manager = await ManagerAsync();
        var token = await Visible(manager).FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new KeyNotFoundException("Integração não encontrada.");
        if (token.RevokedAt.HasValue)
            throw new InvalidOperationException("Integração revogada não pode ser renovada. Cadastre uma nova.");
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == token.CompanyId && c.IsActive)
            ?? throw new InvalidOperationException("A empresa da integração está inativa.");

        var now = DateTime.UtcNow;
        var secret = GenerateSecret();
        token.TokenHash = HashSecret(secret);
        token.TokenPrefix = secret[..12];
        token.RenewedAt = now;
        token.ExpiresAt = now.AddDays(LifetimeDays);
        await db.SaveChangesAsync();

        var creator = await db.Users.AsNoTracking().Where(u => u.Id == token.CreatedByUserId).Select(u => u.FullName).FirstOrDefaultAsync();
        var response = Map(token, company, creator, now, new CreatedIntegrationTokenResponse());
        response.Token = secret;
        return response;
    }

    public async Task RevokeAsync(Guid id)
    {
        var manager = await ManagerAsync();
        var token = await Visible(manager).FirstOrDefaultAsync(t => t.Id == id)
            ?? throw new KeyNotFoundException("Integração não encontrada.");
        if (token.RevokedAt.HasValue) return;
        token.RevokedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task<IntegrationCallPageResponse> GetCallsAsync(Guid? tokenId, int page, int pageSize)
    {
        var manager = await ManagerAsync();
        if (page < 1) throw new InvalidOperationException("A página começa em 1.");
        if (pageSize is < 1 or > 100) throw new InvalidOperationException("O tamanho da página deve ser de 1 a 100.");

        var visible = Visible(manager).Select(t => t.Id);
        var calls = db.IntegrationCalls.AsNoTracking().Where(c => visible.Contains(c.TokenId));
        if (tokenId.HasValue) calls = calls.Where(c => c.TokenId == tokenId.Value);

        var since = DateTime.UtcNow.AddDays(-7);
        return new IntegrationCallPageResponse
        {
            Total = await calls.CountAsync(),
            Page = page,
            PageSize = pageSize,
            CallsLast7Days = await calls.CountAsync(c => c.CreatedAt >= since),
            ErrorsLast7Days = await calls.CountAsync(c => c.CreatedAt >= since && c.StatusCode >= 400),
            Items = await calls.OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(c => new IntegrationCallResponse
                {
                    Id = c.Id, TokenId = c.TokenId, TokenName = c.Token.Name, Method = c.Method, Route = c.Route,
                    ProcessInstanceId = c.ProcessInstanceId, StatusCode = c.StatusCode, DurationMs = c.DurationMs, CreatedAt = c.CreatedAt
                }).ToListAsync()
        };
    }

    public async Task<IntegrationIdentity?> ValidateAsync(string secret, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(secret) || !secret.StartsWith(SecretPrefix, StringComparison.Ordinal) || secret.Length > 200)
            return null;

        var hash = HashSecret(secret);
        var now = DateTime.UtcNow;
        var token = await db.IntegrationTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        if (token is null || token.RevokedAt.HasValue || token.ExpiresAt <= now)
            return null;
        if (!await db.Companies.AnyAsync(c => c.Id == token.CompanyId && c.IsActive, cancellationToken))
            return null;

        if (token.LastUsedAt is null || now - token.LastUsedAt.Value > LastUsedPrecision)
        {
            // ExecuteUpdate não passa pelo SaveChanges (e, portanto, não gera notificações).
            await db.IntegrationTokens.Where(t => t.Id == token.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.LastUsedAt, now), cancellationToken);
        }

        return new IntegrationIdentity(token.Id, token.Name, token.ExternalSystem, token.CompanyId,
            token.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
