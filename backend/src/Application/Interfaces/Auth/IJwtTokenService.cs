using System.Security.Claims;

namespace Sicou.Application.Interfaces.Auth;

public interface IJwtTokenService
{
    string GenerateToken(Guid userId, string email, string fullName, IEnumerable<string> roles);

    DateTime GetExpirationDate();
}