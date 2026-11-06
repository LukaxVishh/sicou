namespace Sicou.Application.Responses.Users;

public record UserTransferResponse(
    Guid Id,
    DateTime CreatedAt,
    string? FromCompanyName,
    string FromUnitName,
    string? ToCompanyName,
    string ToUnitName,
    string PerformedByName,
    bool CopyAccessesRequested,
    int RevokedAreaAccesses,
    int CopiedAreaAccesses,
    int RevokedProcessNodes);
