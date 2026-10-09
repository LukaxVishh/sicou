namespace Sicou.Application.Interfaces.Services;

public record RecoveryUserResponse(Guid Id, string FullName, string Email);
public record TemporaryPasswordResponse(string TemporaryPassword, DateTime ExpiresAt);

public interface IPasswordRecoveryService
{
    Task<IReadOnlyList<RecoveryUserResponse>> GetEligibleUsersAsync();
    Task<TemporaryPasswordResponse> GenerateAsync(Guid userId);
}
