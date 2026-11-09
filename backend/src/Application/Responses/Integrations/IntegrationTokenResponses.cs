namespace Sicou.Application.Responses.Integrations;

public record IntegrationScopeResponse(string Scope, string Description);

public class IntegrationTokenResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ExternalSystem { get; set; } = string.Empty;
    public string TokenPrefix { get; set; } = string.Empty;
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public Guid CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public List<string> Scopes { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RenewedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }

    /// <summary>Active, Expired, Revoked ou Invalidated (empresa inativa).</summary>
    public string Status { get; set; } = string.Empty;
}

/// <summary>Resposta da criação ou renovação: o segredo aparece somente aqui.</summary>
public class CreatedIntegrationTokenResponse : IntegrationTokenResponse
{
    public string Token { get; set; } = string.Empty;
}

public class IntegrationCallResponse
{
    public Guid Id { get; set; }
    public Guid TokenId { get; set; }
    public string TokenName { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public Guid? ProcessInstanceId { get; set; }
    public int StatusCode { get; set; }
    public long DurationMs { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class IntegrationCallPageResponse
{
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int CallsLast7Days { get; set; }
    public int ErrorsLast7Days { get; set; }
    public List<IntegrationCallResponse> Items { get; set; } = new();
}

/// <summary>Integração autenticada em uma chamada.</summary>
public record IntegrationIdentity(
    Guid TokenId,
    string Name,
    string ExternalSystem,
    Guid CompanyId,
    IReadOnlyList<string> Scopes)
{
    /// <summary>Identificador gravado como autor no histórico dos processos.</summary>
    public string ActorId => $"integration:{TokenId}";

    /// <summary>Nome exibido como autor no histórico dos processos.</summary>
    public string ActorName => $"Integração · {Name}";
}
