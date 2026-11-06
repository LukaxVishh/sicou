using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

/// <summary>
/// Registro da transferência de um usuário entre unidades ou empresas (RF-010).
/// Os nomes são gravados no momento da transferência para o histórico não depender de cadastros posteriores.
/// </summary>
public class UserTransfer : BaseEntity
{
    public Guid UserId { get; set; }

    public Guid? FromCompanyId { get; set; }
    public string? FromCompanyName { get; set; }
    public Guid? FromUnitId { get; set; }
    public string? FromUnitName { get; set; }

    public Guid? ToCompanyId { get; set; }
    public string? ToCompanyName { get; set; }
    public Guid? ToUnitId { get; set; }
    public string? ToUnitName { get; set; }

    public Guid PerformedByUserId { get; set; }
    public string PerformedByName { get; set; } = string.Empty;

    /// <summary>Se o administrador pediu para recriar os acessos de setor na nova unidade.</summary>
    public bool CopyAccessesRequested { get; set; }

    public int RevokedAreaAccesses { get; set; }
    public int CopiedAreaAccesses { get; set; }
    public int RevokedProcessNodes { get; set; }
}
