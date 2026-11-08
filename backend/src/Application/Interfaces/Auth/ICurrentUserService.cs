namespace Sicou.Application.Interfaces.Auth;

public interface ICurrentUserService
{
    string? UserId { get; }

    string? Email { get; }

    string? FullName { get; }

    bool IsAuthenticated { get; }

    bool IsInRole(string role);

    /// <summary>Verdadeiro quando a requisição foi autenticada por uma integração (sem usuário).</summary>
    bool IsIntegration { get; }
}