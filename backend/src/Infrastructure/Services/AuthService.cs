using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Requests.Auth;
using Sicou.Application.Responses.Auth;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtTokenService _jwtTokenService;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        IJwtTokenService jwtTokenService)
    {
        _userManager = userManager;
        _jwtTokenService = jwtTokenService;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var existingUser = await _userManager.FindByEmailAsync(request.Email);

        if (existingUser is not null)
            throw new InvalidOperationException("Já existe um usuário cadastrado com este e-mail.");

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName.Trim(),
            UserName = request.Email.Trim(),
            Email = request.Email.Trim(),
            IsActive = true,
            CompanyId = request.CompanyId,
            UnitId = request.UnitId,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
        {
            var errors = string.Join(" | ", result.Errors.Select(e => e.Description));
            throw new InvalidOperationException(errors);
        }

        var roles = await _userManager.GetRolesAsync(user);

        var token = _jwtTokenService.GenerateToken(
            user.Id,
            user.Email!,
            user.FullName,
            roles
        );

        return new AuthResponse
        {
            AccessToken = token,
            ExpiresAt = _jwtTokenService.GetExpirationDate(),
            User = new UserAuthResponse
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email!,
                IsActive = user.IsActive,
                CompanyId = user.CompanyId,
                UnitId = user.UnitId,
                Roles = roles
            }
        };
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);

        if (user is null)
            throw new UnauthorizedAccessException("E-mail ou senha inválidos.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Usuário inativo.");

        var passwordValid = await _userManager.CheckPasswordAsync(user, request.Password);

        if (!passwordValid)
            throw new UnauthorizedAccessException("E-mail ou senha inválidos.");

        var roles = await _userManager.GetRolesAsync(user);

        var token = _jwtTokenService.GenerateToken(
            user.Id,
            user.Email!,
            user.FullName,
            roles
        );

        return new AuthResponse
        {
            AccessToken = token,
            ExpiresAt = _jwtTokenService.GetExpirationDate(),
            User = new UserAuthResponse
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email!,
                IsActive = user.IsActive,
                CompanyId = user.CompanyId,
                UnitId = user.UnitId,
                Roles = roles
            }
        };
    }

    public async Task<UserAuthResponse> GetCurrentUserAsync(Guid userId)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());

        if (user is null)
            throw new UnauthorizedAccessException("Usuário não encontrado.");

        var roles = await _userManager.GetRolesAsync(user);

        return new UserAuthResponse
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email!,
            IsActive = user.IsActive,
            CompanyId = user.CompanyId,
            UnitId = user.UnitId,
            Roles = roles
        };
    }
}