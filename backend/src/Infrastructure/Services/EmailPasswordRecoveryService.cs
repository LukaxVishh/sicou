using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Auth;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class EmailPasswordRecoveryService(UserManager<ApplicationUser> users, ApplicationDbContext db,
    IPasswordRecoveryEmailSender sender, IOptions<PasswordRecoveryEmailOptions> options,
    ILogger<EmailPasswordRecoveryService> logger) : IEmailPasswordRecoveryService
{
    private const string InvalidLink = "Link inválido, já utilizado ou expirado. Solicite uma nova recuperação de senha.";

    public async Task RequestAsync(string email)
    {
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null || !user.IsActive) return;
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.Host)
            || !Uri.TryCreate(settings.FrontendBaseUrl, UriKind.Absolute, out var frontend)
            || (frontend.Scheme != Uri.UriSchemeHttp && frontend.Scheme != Uri.UriSchemeHttps))
        {
            logger.LogError("Recuperação por e-mail indisponível: configure Email:Host e Email:FrontendBaseUrl.");
            return;
        }
        var token = await users.GeneratePasswordResetTokenAsync(user);
        user.EmailPasswordResetTokenHash = Convert.ToHexString(HashToken(user, token));
        user.EmailPasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(30);
        var update = await users.UpdateAsync(user);
        if (!update.Succeeded) throw new InvalidOperationException("Não foi possível solicitar a recuperação. Tente novamente.");
        var encoded = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        // The trusted configured frontend origin is used instead of a request Host header.
        var link = QueryHelpers.AddQueryString(new Uri(frontend, "/reset-password").AbsoluteUri,
            new Dictionary<string, string?> { ["email"] = user.Email, ["token"] = encoded });
        try { await sender.SendAsync(user.Email!, link); }
        catch
        {
            // Never reveal account existence, recipient addresses or reset tokens in the response/log.
            logger.LogError("Falha na entrega do e-mail de recuperação. Verifique a disponibilidade do serviço SMTP.");
        }
    }

    public async Task ResetAsync(ResetPasswordRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null || !user.IsActive || user.EmailPasswordResetExpiresAt <= DateTime.UtcNow
            || !user.EmailPasswordResetExpiresAt.HasValue || user.EmailPasswordResetTokenHash == null)
            throw new InvalidOperationException(InvalidLink);
        string token;
        try { token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token)); }
        catch (FormatException) { throw new InvalidOperationException(InvalidLink); }
        if (!CryptographicOperations.FixedTimeEquals(HashToken(user, token),
            Convert.FromHexString(user.EmailPasswordResetTokenHash))) throw new InvalidOperationException(InvalidLink);

        await using var transaction = await db.Database.BeginTransactionAsync();
        user.MustChangePassword = false;
        user.TemporaryPasswordExpiresAt = null;
        user.EmailPasswordResetTokenHash = null;
        user.EmailPasswordResetExpiresAt = null;
        user.UpdatedAt = DateTime.UtcNow;
        var reset = await users.ResetPasswordAsync(user, token, request.NewPassword);
        if (!reset.Succeeded)
        {
            if (reset.Errors.Any(e => e.Code is "InvalidToken" or "ConcurrencyFailure"))
                throw new InvalidOperationException(InvalidLink);
            throw new InvalidOperationException(string.Join(" | ", reset.Errors.Select(e => e.Description)));
        }
        var unlock = await users.SetLockoutEndDateAsync(user, null);
        var attempts = await users.ResetAccessFailedCountAsync(user);
        if (!unlock.Succeeded || !attempts.Succeeded) throw new InvalidOperationException("Não foi possível liberar o acesso. Solicite uma nova recuperação.");
        await transaction.CommitAsync();
    }

    private static byte[] HashToken(ApplicationUser user, string token) =>
        SHA256.HashData(Encoding.UTF8.GetBytes($"{user.NormalizedEmail}\n{token}"));
}
