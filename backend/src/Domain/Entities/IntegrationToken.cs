namespace Sicou.Domain.Entities;

/// <summary>
/// Integração externa cadastrada por um administrador (UC-020 / RF-023): nome, sistema externo e escopos de acesso.
/// A integração pertence a uma empresa e não age em nome de nenhum usuário: o que ela pode fazer é definido pelos
/// escopos, sempre limitado aos dados da sua empresa. O segredo não é armazenado; guarda-se apenas o SHA-256.
/// </summary>
public class IntegrationToken
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Empresa à qual a integração pertence. Define o alcance dos dados acessíveis.</summary>
    public Guid CompanyId { get; set; }

    /// <summary>Administrador que cadastrou a integração (rastreabilidade).</summary>
    public Guid CreatedByUserId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string ExternalSystem { get; set; } = string.Empty;

    /// <summary>SHA-256 do segredo, em hexadecimal minúsculo (64 caracteres).</summary>
    public string TokenHash { get; set; } = string.Empty;

    /// <summary>Prefixo exibível do segredo, para reconhecer o token sem expô-lo.</summary>
    public string TokenPrefix { get; set; } = string.Empty;

    /// <summary>Escopos separados por espaço.</summary>
    public string Scopes { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }

    /// <summary>Última geração do segredo (criação ou renovação).</summary>
    public DateTime? RenewedAt { get; set; }

    public ICollection<IntegrationCall> Calls { get; set; } = new List<IntegrationCall>();
}

/// <summary>Registro de auditoria de uma chamada feita por uma integração. Não guarda corpo, query ou credenciais.</summary>
public class IntegrationCall
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TokenId { get; set; }
    public IntegrationToken Token { get; set; } = null!;
    public string Method { get; set; } = string.Empty;

    /// <summary>Template da rota (ex.: <c>api/integrations/v1/processes/{id}/advance</c>), sem IDs concretos.</summary>
    public string Route { get; set; } = string.Empty;

    /// <summary>Processo afetado, quando a rota se refere a um processo.</summary>
    public Guid? ProcessInstanceId { get; set; }

    public int StatusCode { get; set; }
    public long DurationMs { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
