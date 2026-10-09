using Sicou.Application.Requests.Auth;

namespace Sicou.Application.Interfaces.Services;

public interface IEmailPasswordRecoveryService
{
    Task RequestAsync(string email);
    Task ResetAsync(ResetPasswordRequest request);
}

public interface IPasswordRecoveryEmailSender
{
    Task SendAsync(string email, string link);
}
