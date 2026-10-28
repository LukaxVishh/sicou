using System.ComponentModel.DataAnnotations;
using Sicou.Domain.Enums;

namespace Sicou.Application.Interfaces.Services;

public class ReportFilter
{
    public Guid? CompanyId { get; set; }
    public Guid? AreaId { get; set; }
    public Guid? UnitId { get; set; }
    public ProcessStatus? Status { get; set; }
    public Guid? ResponsibleUserId { get; set; }
    public bool UnassignedOnly { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    /// <summary>"moved" = somente processos tramitados; "notMoved" = ainda sem tramitação após o protocolo.</summary>
    [StringLength(20)] public string? Movement { get; set; }
    [Range(1, int.MaxValue)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 25;
    public string? Columns { get; set; }
}

public record ReportOption(Guid Id, string Name, Guid? CompanyId = null, Guid? AreaId = null);
public record ReportOptions(IReadOnlyList<ReportOption> Companies, IReadOnlyList<ReportOption> Areas,
    IReadOnlyList<ReportOption> Units, IReadOnlyList<ReportOption> Responsibles);
public record ReportRow(Guid Id, Guid CompanyId, Guid AreaId, Guid? OriginUnitId, string Number, string Title, string Company, string Area, string Unit,
    string ProcessType, string Status, Guid? ResponsibleUserId, string Responsible, string CreatedBy,
    DateTime CreatedAt, DateTime? UpdatedAt, bool CanAssign)
{
    // Dados de tramitação, calculados a partir de ProcessHistory (init para manter o construtor posicional compatível).
    public string CurrentStage { get; init; } = "";
    public string CurrentUnit { get; init; } = "";
    public string OpenedBy { get; init; } = "";
    public DateTime? OpenedAt { get; init; }
    public DateTime? ClosedAt { get; init; }
    public int? DaysOpen { get; init; }
    public int? DaysInStage { get; init; }
    public int Movements { get; init; }
    public int Advances { get; init; }
    public int Returns { get; init; }
    public int Transfers { get; init; }
    public int Comments { get; init; }
    public DateTime? LastMovementAt { get; init; }
    public string LastMovementAction { get; init; } = "";
    public string LastMovementBy { get; init; } = "";
    public string LastObservation { get; init; } = "";
    public string StagePath { get; init; } = "";
    public string UnitPath { get; init; } = "";
    public string Participants { get; init; } = "";
    public string FormData { get; init; } = "";
}
public record ReportResult(IReadOnlyList<ReportRow> Items, int Total, int Page, int PageSize);
public record ReportFile(byte[] Content, string ContentType, string FileName);
public record AssignResponsibleRequest(Guid? UserId);

public class CatalogReportFilter
{
    public Guid? CompanyId { get; set; }
    public Guid? AreaId { get; set; }
    public Guid? UnitId { get; set; }
    public Guid? CategoryId { get; set; }
    [StringLength(200)] public string? Search { get; set; }
    [StringLength(100)] public string? City { get; set; }
    [StringLength(2)] public string? State { get; set; }
    public string? Role { get; set; }
    public string? Status { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    [Range(1, int.MaxValue)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 25;
    public string? Columns { get; set; }
}
public record ReportColumn(string Key, string Label, string Type = "text");
public record CatalogReportRow(Guid Id, IReadOnlyDictionary<string, object?> Values);
public record CatalogReportResult(IReadOnlyList<ReportColumn> Columns, IReadOnlyList<CatalogReportRow> Items, int Total, int Page, int PageSize);
public record CatalogReportOptions(IReadOnlyList<string> Kinds, IReadOnlyList<ReportOption> Companies,
    IReadOnlyList<ReportOption> Areas, IReadOnlyList<ReportOption> Units, IReadOnlyList<ReportOption> Categories);

public interface IReportService
{
    Task<ReportOptions> GetOptionsAsync(CancellationToken ct);
    Task<ReportResult> GetAsync(ReportFilter filter, CancellationToken ct);
    Task<ReportFile> ExportAsync(ReportFilter filter, string format, CancellationToken ct);
    Task AssignAsync(Guid processId, Guid? userId, CancellationToken ct);
    Task<IReadOnlyList<ReportOption>> GetAssignmentOptionsAsync(Guid processId, CancellationToken ct);
    Task<CatalogReportOptions> GetCatalogOptionsAsync(CancellationToken ct);
    Task<CatalogReportResult> GetCatalogAsync(string kind, CatalogReportFilter filter, bool exporting, CancellationToken ct);
    Task<ReportFile> ExportCatalogAsync(string kind, CatalogReportFilter filter, string format, CancellationToken ct);
}
