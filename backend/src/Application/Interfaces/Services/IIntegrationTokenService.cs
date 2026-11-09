using Sicou.Application.Requests.Integrations;
using Sicou.Application.Responses.Integrations;

namespace Sicou.Application.Interfaces.Services;

public interface IIntegrationTokenService
{
    IReadOnlyList<IntegrationScopeResponse> GetScopes();
    Task<IReadOnlyList<IntegrationTokenResponse>> GetTokensAsync(Guid? companyId);
    Task<CreatedIntegrationTokenResponse> CreateAsync(CreateIntegrationTokenRequest request);

    /// <summary>Gera um novo segredo e nova validade (UC-020/E1). O segredo anterior deixa de valer.</summary>
    Task<CreatedIntegrationTokenResponse> RenewAsync(Guid id);

    Task RevokeAsync(Guid id);
    Task<IntegrationCallPageResponse> GetCallsAsync(Guid? tokenId, int page, int pageSize);

    /// <summary>Valida o segredo. Retorna nulo quando a integração não deve ser aceita.</summary>
    Task<IntegrationIdentity?> ValidateAsync(string secret, CancellationToken cancellationToken = default);
}
