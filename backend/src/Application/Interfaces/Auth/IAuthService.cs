using Sicou.Application.Requests.Auth;
using Sicou.Application.Responses.Auth;

namespace Sicou.Application.Interfaces.Auth;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);

    Task<AuthResponse> LoginAsync(LoginRequest request);

    Task<UserAuthResponse> GetCurrentUserAsync(Guid userId);
}