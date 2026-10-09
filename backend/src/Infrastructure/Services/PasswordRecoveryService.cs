using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Services;
using Sicou.Domain.Constants;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class PasswordRecoveryService(UserManager<ApplicationUser> users, ApplicationDbContext db,
    ICurrentUserService currentUser) : IPasswordRecoveryService
{
    private static int Rank(IEnumerable<string> roles) => roles.Select(r => r switch
    {
        SystemRoles.SuperAdmin => 4,
        SystemRoles.CompanyAdmin => 3,
        SystemRoles.AreaAdmin => 2,
        _ => 1
    }).DefaultIfEmpty(1).Max();

    private async Task<ApplicationUser> ActorAsync() =>
        await users.FindByIdAsync(currentUser.UserId ?? string.Empty) is { IsActive: true } user
            ? user : throw new UnauthorizedAccessException("Usuário inativo ou não autenticado.");

    private async Task<bool> CanRecoverAsync(ApplicationUser actor, ApplicationUser target)
    {
        if (!target.IsActive || actor.Id == target.Id) return false;
        var rank = Rank(await users.GetRolesAsync(actor));
        if (rank <= Rank(await users.GetRolesAsync(target)) || rank < 3) return false;
        if (rank == 4) return true;
        if (!actor.CompanyId.HasValue || actor.CompanyId != target.CompanyId) return false;
        return await db.Companies.AnyAsync(c => c.Id == actor.CompanyId && c.IsActive);
    }

    public async Task<IReadOnlyList<RecoveryUserResponse>> GetEligibleUsersAsync()
    {
        var actor = await ActorAsync();
        var rank = Rank(await users.GetRolesAsync(actor));
        if (rank < 3) throw new UnauthorizedAccessException("Somente Super Admin e Admin da Empresa podem recuperar senhas.");
        var candidates = await users.Users.Where(u => u.IsActive && u.Id != actor.Id
            && (rank == 4 || u.CompanyId == actor.CompanyId)).OrderBy(u => u.FullName).ToListAsync();
        var result = new List<RecoveryUserResponse>();
        foreach (var target in candidates)
            if (await CanRecoverAsync(actor, target)) result.Add(new(target.Id, target.FullName, target.Email!));
        return result;
    }

    public async Task<TemporaryPasswordResponse> GenerateAsync(Guid userId)
    {
        var actor = await ActorAsync();
        var target = await users.FindByIdAsync(userId.ToString())
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
        if (!await CanRecoverAsync(actor, target))
            throw new UnauthorizedAccessException("Recupere apenas usuários de cargo inferior dentro do seu escopo.");
        var password = "Tmp!" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)) + "a1";
        var expiresAt = DateTime.UtcNow.AddHours(24);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var token = await users.GeneratePasswordResetTokenAsync(target);
        target.MustChangePassword = true;
        target.TemporaryPasswordExpiresAt = expiresAt;
        target.PasswordRecoveryByUserId = actor.Id;
        target.PasswordRecoveryAt = DateTime.UtcNow;
        target.EmailPasswordResetTokenHash = null;
        target.EmailPasswordResetExpiresAt = null;
        var reset = await users.ResetPasswordAsync(target, token, password);
        if (!reset.Succeeded) throw new InvalidOperationException(string.Join(" | ", reset.Errors.Select(e => e.Description)));
        var unlock = await users.SetLockoutEndDateAsync(target, null);
        var attempts = await users.ResetAccessFailedCountAsync(target);
        if (!unlock.Succeeded || !attempts.Succeeded) throw new InvalidOperationException("Não foi possível liberar o acesso temporário.");
        await transaction.CommitAsync();
        return new(password, expiresAt);
    }
}
