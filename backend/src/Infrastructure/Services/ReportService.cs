using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Services;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public partial class ReportService(ApplicationDbContext db, UserManager<ApplicationUser> users, ICurrentUserService current) : IReportService
{
    private record Scope(ApplicationUser Actor, bool Super, bool Admin, IQueryable<Area> Areas);

    private async Task<Scope> ScopeAsync()
    {
        var actor = await users.FindByIdAsync(current.UserId ?? "");
        if (actor is not { IsActive: true }) throw new UnauthorizedAccessException("Usuário inativo ou não autenticado.");
        var roles = await users.GetRolesAsync(actor);
        var super = roles.Contains(SystemRoles.SuperAdmin);
        var admin = super || roles.Contains(SystemRoles.CompanyAdmin);
        var areas = db.Areas.AsNoTracking().Where(a => a.IsActive && a.Company.IsActive);
        if (!super)
        {
            if (actor.CompanyId == null || !await db.Companies.AnyAsync(c => c.Id == actor.CompanyId && c.IsActive))
                throw new UnauthorizedAccessException("Usuário sem empresa ativa.");
            if (actor.UnitId.HasValue && !await db.Units.AnyAsync(u => u.Id == actor.UnitId && u.CompanyId == actor.CompanyId && u.IsActive))
                throw new UnauthorizedAccessException("Unidade do usuário indisponível.");
            areas = areas.Where(a => a.CompanyId == actor.CompanyId);
            if (!admin)
                areas = areas.Where(a => db.UserAreaAccesses.Any(x => x.UserId == current.UserId && x.IsActive
                    && x.CompanyId == a.CompanyId && x.AreaId == a.Id && x.UnitId == actor.UnitId
                    && (x.CanView || x.CanManage || x.CanManageWorkflows || x.CanHandleWorkflowRequests)));
        }
        return new(actor, super, admin, areas);
    }

    private IQueryable<ProcessInstance> Processes(Scope scope) => db.ProcessInstances.AsNoTracking()
        .Where(p => p.IsActive && scope.Areas.Any(a => a.Id == p.AreaId && a.CompanyId == p.CompanyId)
            && (p.OriginUnitId == null || (p.OriginUnit!.IsActive && p.OriginUnit.CompanyId == p.CompanyId)))
        .Where(p => scope.Admin || scope.Actor.UnitId == null || p.OriginUnitId == scope.Actor.UnitId);

    private IQueryable<ApplicationUser> Candidates(Scope scope) => db.Users.AsNoTracking().Where(u => u.IsActive
        && scope.Areas.Any(a => a.CompanyId == u.CompanyId)
        && (scope.Admin || scope.Actor.UnitId == null || u.UnitId == null || u.UnitId == scope.Actor.UnitId)
        && (scope.Admin || db.UserRoles.Any(ur => ur.UserId == u.Id && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == SystemRoles.CompanyAdmin))
            || db.UserAreaAccesses.Any(x => x.UserId == u.Id.ToString() && x.IsActive && x.CompanyId == u.CompanyId
                && x.UnitId == u.UnitId && scope.Areas.Any(a => a.Id == x.AreaId)
                && (x.CanView || x.CanManage || x.CanManageWorkflows || x.CanHandleWorkflowRequests))));

    private async Task<IQueryable<ProcessInstance>> FilterAsync(Scope scope, ReportFilter filter, CancellationToken ct)
    {
        if (filter.StartDate > filter.EndDate) throw new ArgumentException("A data inicial deve ser anterior ou igual à final.");
        if (filter.EndDate == DateOnly.MaxValue) throw new ArgumentException("Data final fora do intervalo permitido.");
        if (filter.Status.HasValue && !Enum.IsDefined(filter.Status.Value)) throw new ArgumentException("Status inválido.");
        if (filter.UnassignedOnly && filter.ResponsibleUserId.HasValue) throw new ArgumentException("Escolha um responsável ou sem responsável.");
        if (filter.Movement is not (null or "" or "moved" or "notMoved")) throw new ArgumentException("Filtro de tramitação inválido.");
        if (filter.CompanyId.HasValue && !await scope.Areas.AnyAsync(a => a.CompanyId == filter.CompanyId, ct))
            throw new UnauthorizedAccessException("Empresa fora do seu escopo de relatórios.");
        if (filter.AreaId.HasValue && !await scope.Areas.AnyAsync(a => a.Id == filter.AreaId && (!filter.CompanyId.HasValue || a.CompanyId == filter.CompanyId), ct))
            throw new UnauthorizedAccessException("Setor fora do seu escopo de relatórios.");
        if (filter.UnitId.HasValue && !await db.Units.AnyAsync(u => u.Id == filter.UnitId && u.IsActive
            && scope.Areas.Any(a => a.CompanyId == u.CompanyId && (!filter.AreaId.HasValue || a.Id == filter.AreaId))
            && (!filter.CompanyId.HasValue || u.CompanyId == filter.CompanyId)
            && (scope.Admin || scope.Actor.UnitId == null || u.Id == scope.Actor.UnitId), ct))
            throw new UnauthorizedAccessException("Unidade fora do seu escopo de relatórios.");
        if (filter.ResponsibleUserId.HasValue && !await Candidates(scope).AnyAsync(u => u.Id == filter.ResponsibleUserId
            && (!filter.CompanyId.HasValue || u.CompanyId == filter.CompanyId)
            && (!filter.AreaId.HasValue || scope.Areas.Any(a => a.Id == filter.AreaId && a.CompanyId == u.CompanyId)), ct))
            throw new UnauthorizedAccessException("Responsável fora do seu escopo de relatórios.");
        var query = Processes(scope);
        if (filter.CompanyId.HasValue) query = query.Where(p => p.CompanyId == filter.CompanyId);
        if (filter.AreaId.HasValue) query = query.Where(p => p.AreaId == filter.AreaId);
        if (filter.UnitId.HasValue) query = query.Where(p => p.OriginUnitId == filter.UnitId);
        if (filter.Status.HasValue) query = query.Where(p => p.Status == filter.Status);
        if (filter.ResponsibleUserId.HasValue) query = query.Where(p => p.ResponsibleUserId == filter.ResponsibleUserId);
        if (filter.UnassignedOnly) query = query.Where(p => p.ResponsibleUserId == null);
        // Tramitado = qualquer movimentação além do protocolo (avanço que sai da confecção) e de comentários.
        if (filter.Movement == "moved") query = query.Where(p => db.ProcessHistories.Any(h => h.ProcessInstanceId == p.Id && h.IsActive
                && (h.Action == ProcessActionType.Return || h.Action == ProcessActionType.Restart || h.Action == ProcessActionType.Transfer
                || h.Action == ProcessActionType.Cancel || (h.Action == ProcessActionType.Advance && h.FromNode != null && h.FromNode.NodeType != ProcessNodeType.StartConfection))));
        if (filter.Movement == "notMoved") query = query.Where(p => !db.ProcessHistories.Any(h => h.ProcessInstanceId == p.Id && h.IsActive
                && (h.Action == ProcessActionType.Return || h.Action == ProcessActionType.Restart || h.Action == ProcessActionType.Transfer
                || h.Action == ProcessActionType.Cancel || (h.Action == ProcessActionType.Advance && h.FromNode != null && h.FromNode.NodeType != ProcessNodeType.StartConfection))));
        if (filter.StartDate.HasValue)
        {
            var start = filter.StartDate.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(p => p.CreatedAt >= start);
        }
        if (filter.EndDate.HasValue)
        {
            var end = filter.EndDate.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(p => p.CreatedAt < end);
        }
        return query;
    }

    public async Task<ReportOptions> GetOptionsAsync(CancellationToken ct)
    {
        var scope = await ScopeAsync();
        var companies = await db.Companies.Where(c => scope.Areas.Any(a => a.CompanyId == c.Id)).OrderBy(c => c.Name)
            .Select(c => new ReportOption(c.Id, c.Name, null, null)).ToListAsync(ct);
        var areas = await scope.Areas.OrderBy(a => a.Name).Select(a => new ReportOption(a.Id, a.Name, a.CompanyId, null)).ToListAsync(ct);
        var units = await db.Units.Where(u => u.IsActive && scope.Areas.Any(a => a.CompanyId == u.CompanyId)
            && (scope.Admin || scope.Actor.UnitId == null || u.Id == scope.Actor.UnitId)).OrderBy(u => u.Name)
            .Select(u => new ReportOption(u.Id, u.Name, u.CompanyId, null)).ToListAsync(ct);
        var responsible = await Candidates(scope).OrderBy(u => u.FullName)
            .Select(u => new ReportOption(u.Id, u.FullName, u.CompanyId, null)).ToListAsync(ct);
        return new(companies, areas, units, responsible);
    }

    private async Task<List<ReportRow>> RowsAsync(IQueryable<ProcessInstance> query, Scope scope, bool includeForm, CancellationToken ct)
    {
        var data = await (from p in query
            join u in db.Users on p.ResponsibleUserId equals (Guid?)u.Id into assigned
            from u in assigned.DefaultIfEmpty()
            select new { p.Id, p.CompanyId, p.AreaId, p.OriginUnitId, p.ProcessNumber, p.Title, Company = p.Company.Name, Area = p.Area.Name,
                Unit = p.OriginUnit == null ? "Sede" : p.OriginUnit.Name, ProcessType = p.ProcessType.Name,
                p.Status, p.ResponsibleUserId, Responsible = u == null ? "Sem responsável" : u.FullName,
                p.CreatedByUserName, p.CreatedAt, p.UpdatedAt,
                CurrentStage = p.CurrentNode.Name,
                CurrentUnit = p.CurrentUnitName ?? (p.CurrentUnit != null ? p.CurrentUnit.Name : null),
                p.OpenedByUserName, p.OpenedAt,
                CanAssign = scope.Admin || db.UserAreaAccesses.Any(x => x.UserId == current.UserId && x.IsActive
                    && x.CompanyId == p.CompanyId && x.AreaId == p.AreaId && x.UnitId == scope.Actor.UnitId
                    && (x.CanManage || x.CanManageWorkflows)) }).ToListAsync(ct);
        var ids = data.Select(p => p.Id).ToArray();
        var history = ids.Length == 0 ? new List<HistoryEntry>() : await db.ProcessHistories.AsNoTracking()
            .Where(h => h.IsActive && ids.Contains(h.ProcessInstanceId))
            .OrderBy(h => h.CreatedAt).ThenBy(h => h.Id)
            .Select(h => new HistoryEntry(h.ProcessInstanceId, h.CreatedAt, h.Action, h.FromNodeId, h.ToNodeId,
                h.FromNode == null ? null : (ProcessNodeType?)h.FromNode.NodeType,
                h.ToNode == null ? null : h.ToNode.Name, h.ToUnitName, h.UserFullName, h.Observations))
            .ToListAsync(ct);
        var historyByProcess = history.ToLookup(h => h.ProcessId);
        var forms = new Dictionary<Guid, string>();
        if (includeForm && ids.Length > 0)
        {
            var values = await (from v in db.ProcessFieldValues.AsNoTracking()
                join p in db.ProcessInstances on v.ProcessInstanceId equals p.Id
                where v.IsActive && ids.Contains(v.ProcessInstanceId) && v.Value != null && v.Value != ""
                select new { v.ProcessInstanceId, v.FieldDefinition.Name, v.FieldDefinition.Type, v.Value,
                    Order = db.ProcessTypeFields.Where(f => f.ProcessTypeId == p.ProcessTypeId && f.FieldDefinitionId == v.FieldDefinitionId)
                        .Select(f => (int?)f.DisplayOrder).Min() ?? int.MaxValue }).ToListAsync(ct);
            foreach (var group in values.GroupBy(v => v.ProcessInstanceId))
                forms[group.Key] = Truncate(string.Join(" | ", group.OrderBy(v => v.Order).ThenBy(v => v.Name)
                    .Select(v => $"{v.Name}: {FieldText(v.Type, v.Value!)}")), 4000);
        }
        var now = DateTime.UtcNow;
        return data.Select(p =>
        {
            var tracking = Track(historyByProcess[p.Id].ToList(), p.Status, p.Unit, p.OpenedAt ?? p.CreatedAt, p.UpdatedAt, now);
            return new ReportRow(p.Id, p.CompanyId, p.AreaId, p.OriginUnitId, p.ProcessNumber, p.Title ?? "", p.Company, p.Area, p.Unit,
                p.ProcessType, StatusLabel(p.Status), p.ResponsibleUserId, p.Responsible, p.CreatedByUserName ?? "",
                p.CreatedAt, p.UpdatedAt, p.CanAssign)
            {
                CurrentStage = p.CurrentStage,
                CurrentUnit = p.CurrentUnit ?? p.Unit,
                OpenedBy = p.OpenedByUserName ?? "",
                OpenedAt = p.OpenedAt,
                ClosedAt = tracking.ClosedAt,
                DaysOpen = tracking.DaysOpen,
                DaysInStage = tracking.DaysInStage,
                Movements = tracking.Advances + tracking.Returns + tracking.Transfers + tracking.Cancels,
                Advances = tracking.Advances,
                Returns = tracking.Returns,
                Transfers = tracking.Transfers,
                Comments = tracking.Comments,
                LastMovementAt = tracking.LastMovement?.At,
                LastMovementAction = tracking.LastMovementLabel,
                LastMovementBy = tracking.LastMovement?.User ?? "",
                LastObservation = Truncate(tracking.LastObservation, 1000),
                StagePath = Truncate(tracking.StagePath, 2000),
                UnitPath = Truncate(tracking.UnitPath, 1000),
                Participants = tracking.Participants,
                FormData = forms.GetValueOrDefault(p.Id, ""),
            };
        }).ToList();
    }

    private record HistoryEntry(Guid ProcessId, DateTime At, ProcessActionType Action, Guid? FromNodeId, Guid? ToNodeId,
        ProcessNodeType? FromNodeType, string? ToNode, string? ToUnit, string? User, string? Observations);

    private record Tracking(int Advances, int Returns, int Transfers, int Cancels, int Comments, HistoryEntry? LastMovement,
        string LastMovementLabel, string LastObservation, DateTime? ClosedAt, int? DaysOpen, int? DaysInStage,
        string StagePath, string UnitPath, string Participants);

    private static bool IsTerminal(ProcessStatus status) => status is ProcessStatus.Approved or ProcessStatus.Rejected
        or ProcessStatus.Finished or ProcessStatus.AdministrativeCancellation;

    /// <summary>
    /// Consolida o histórico de um processo (em ordem cronológica). O primeiro avanço a partir da confecção
    /// (ou sem etapa de origem) é o protocolo e não conta como tramitação.
    /// </summary>
    private static Tracking Track(IReadOnlyList<HistoryEntry> entries, ProcessStatus status, string originUnit,
        DateTime openedAt, DateTime? updatedAt, DateTime now)
    {
        int advances = 0, returns = 0, transfers = 0, cancels = 0, comments = 0;
        var protocolSeen = false;
        HistoryEntry? last = null;
        var lastLabel = "";
        var lastObservation = "";
        DateTime? stageSince = null;
        Guid? currentNode = null;
        var stages = new List<string>();
        var units = new List<string> { originUnit };
        var participants = new List<string>();
        foreach (var h in entries)
        {
            var label = ActionLabel(h.Action);
            if (h.Action == ProcessActionType.Advance && !protocolSeen && (h.FromNodeId == null || h.FromNodeType == ProcessNodeType.StartConfection))
            {
                protocolSeen = true;
                label = h.FromNodeId == null ? "Abertura" : "Protocolo";
            }
            else switch (h.Action)
            {
                case ProcessActionType.Advance: advances++; break;
                case ProcessActionType.Return or ProcessActionType.Restart: returns++; break;
                case ProcessActionType.Transfer: transfers++; break;
                case ProcessActionType.Cancel: cancels++; break;
                default: comments++; break;
            }
            if (h.Action != ProcessActionType.Comment) { last = h; lastLabel = label; }
            if (!string.IsNullOrWhiteSpace(h.Observations)) lastObservation = h.Observations.Trim();
            if (h.ToNodeId.HasValue && h.ToNodeId != currentNode)
            {
                currentNode = h.ToNodeId;
                stageSince = h.At;
                if (!string.IsNullOrEmpty(h.ToNode) && (stages.Count == 0 || stages[^1] != h.ToNode)) stages.Add(h.ToNode);
            }
            if (h.Action == ProcessActionType.Transfer && !string.IsNullOrWhiteSpace(h.ToUnit) && units[^1] != h.ToUnit) units.Add(h.ToUnit);
            if (!string.IsNullOrWhiteSpace(h.User) && !participants.Contains(h.User)) participants.Add(h.User);
        }
        DateTime? closedAt = IsTerminal(status) ? last?.At ?? updatedAt : null;
        int? Days(DateTime? from, DateTime to) => from.HasValue ? Math.Max(0, (int)Math.Floor((to - from.Value).TotalDays)) : null;
        var daysOpen = status == ProcessStatus.Draft ? null : Days(openedAt, closedAt ?? now);
        var daysInStage = closedAt.HasValue || status == ProcessStatus.Draft ? null : Days(stageSince, now);
        return new(advances, returns, transfers, cancels, comments, last, lastLabel, lastObservation, closedAt, daysOpen, daysInStage,
            string.Join(" → ", stages), string.Join(" → ", units), string.Join(", ", participants));
    }

    private static string Truncate(string text, int max) => text.Length <= max ? text : text[..(max - 1)] + "…";

    /// <summary>Valor do formulário em texto legível; anexos não expõem o caminho armazenado.</summary>
    private static string FieldText(FieldType type, string value)
    {
        value = value.Trim();
        switch (type)
        {
            case FieldType.Boolean:
                return value.Equals("true", StringComparison.OrdinalIgnoreCase) ? "Sim"
                    : value.Equals("false", StringComparison.OrdinalIgnoreCase) ? "Não" : value;
            case FieldType.FileAttachment:
                return "anexo enviado";
            case FieldType.MultiSelect when value.StartsWith('['):
                try { return string.Join(", ", JsonSerializer.Deserialize<string[]>(value) ?? []); }
                catch (JsonException) { return value; }
            case FieldType.Date when DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var date):
                return date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
            default:
                return string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        }
    }

    public static string ActionLabel(ProcessActionType action) => action switch {
        ProcessActionType.Advance => "Avanço", ProcessActionType.Return => "Devolução", ProcessActionType.Restart => "Reinício",
        ProcessActionType.Comment => "Comentário", ProcessActionType.Cancel => "Cancelamento", ProcessActionType.Transfer => "Transferência",
        _ => action.ToString() };

    public async Task<ReportResult> GetAsync(ReportFilter filter, CancellationToken ct)
    {
        if (filter.Page < 1 || filter.PageSize is < 1 or > 100 || filter.Page > int.MaxValue / filter.PageSize)
            throw new ArgumentException("Paginação inválida.");
        var scope = await ScopeAsync();
        var query = await FilterAsync(scope, filter, ct);
        var total = await query.CountAsync(ct);
        var rows = await RowsAsync(query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id)
            .Skip((filter.Page - 1) * filter.PageSize).Take(filter.PageSize), scope, true, ct);
        return new(rows, total, filter.Page, filter.PageSize);
    }

    public async Task<ReportFile> ExportAsync(ReportFilter filter, string format, CancellationToken ct)
    {
        if (format is not ("csv" or "xlsx" or "pdf")) throw new ArgumentException("Formato inválido. Use PDF, XLSX ou CSV.");
        var scope = await ScopeAsync();
        var query = await FilterAsync(scope, filter, ct);
        var includeForm = filter.Columns?.Split(',', StringSplitOptions.TrimEntries).Contains("formData") == true;
        var rows = await RowsAsync(query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id).Take(5001), scope, includeForm, ct);
        if (rows.Count > 5000) throw new ArgumentException("A exportação permite até 5.000 processos. Refine os filtros.");
        return ReportExporter.Export(rows, filter, format);
    }

    public async Task AssignAsync(Guid processId, Guid? userId, CancellationToken ct)
    {
        var scope = await ScopeAsync();
        var visible = await Processes(scope).FirstOrDefaultAsync(p => p.Id == processId, ct)
            ?? throw new KeyNotFoundException("Processo não encontrado no seu escopo.");
        if (!scope.Admin && !await db.UserAreaAccesses.AnyAsync(x => x.UserId == current.UserId && x.IsActive
            && x.CompanyId == visible.CompanyId && x.AreaId == visible.AreaId && x.UnitId == scope.Actor.UnitId
            && (x.CanManage || x.CanManageWorkflows), ct)) throw new UnauthorizedAccessException("Sem permissão para atribuir responsáveis.");
        ApplicationUser? target = null;
        if (userId.HasValue)
        {
            target = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive && u.CompanyId == visible.CompanyId, ct);
            if (target == null || (target.UnitId.HasValue && target.UnitId != visible.OriginUnitId))
                throw new ArgumentException("Responsável deve ser ativo e pertencer à empresa e à unidade do processo ou à sede.");
            var roles = await users.GetRolesAsync(target);
            if (!roles.Contains(SystemRoles.CompanyAdmin) && !await db.UserAreaAccesses.AnyAsync(x => x.UserId == target.Id.ToString()
                && x.IsActive && x.CompanyId == visible.CompanyId && x.AreaId == visible.AreaId && x.UnitId == target.UnitId
                && (x.CanManage || x.CanManageWorkflows || x.CanHandleWorkflowRequests), ct))
                throw new ArgumentException("Responsável precisa ter permissão para tratar processos deste setor.");
        }
        var process = await db.ProcessInstances.FirstAsync(p => p.Id == processId, ct);
        if (process.ResponsibleUserId == userId) return;
        var previous = process.ResponsibleUserId.HasValue ? await db.Users.Where(u => u.Id == process.ResponsibleUserId).Select(u => u.FullName).FirstOrDefaultAsync(ct) : null;
        process.ResponsibleUserId = userId;
        process.UpdatedAt = DateTime.UtcNow;
        db.ProcessHistories.Add(new ProcessHistory { ProcessInstanceId = process.Id, Action = ProcessActionType.Comment,
            UserId = scope.Actor.Id.ToString(), UserFullName = scope.Actor.FullName,
            Observations = $"Responsável alterado: {previous ?? "Sem responsável"} → {target?.FullName ?? "Sem responsável"}." });
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ReportOption>> GetAssignmentOptionsAsync(Guid processId, CancellationToken ct)
    {
        var scope = await ScopeAsync();
        var process = await Processes(scope).FirstOrDefaultAsync(p => p.Id == processId, ct)
            ?? throw new KeyNotFoundException("Processo não encontrado no seu escopo.");
        if (!scope.Admin && !await db.UserAreaAccesses.AnyAsync(x => x.UserId == current.UserId && x.IsActive
            && x.CompanyId == process.CompanyId && x.AreaId == process.AreaId && x.UnitId == scope.Actor.UnitId
            && (x.CanManage || x.CanManageWorkflows), ct)) throw new UnauthorizedAccessException("Sem permissão para atribuir responsáveis.");
        return await db.Users.Where(u => u.IsActive && u.CompanyId == process.CompanyId
            && (u.UnitId == null || u.UnitId == process.OriginUnitId)
            && (db.UserRoles.Any(ur => ur.UserId == u.Id && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == SystemRoles.CompanyAdmin))
                || db.UserAreaAccesses.Any(x => x.UserId == u.Id.ToString() && x.IsActive && x.CompanyId == process.CompanyId
                    && x.AreaId == process.AreaId && x.UnitId == u.UnitId && (x.CanManage || x.CanManageWorkflows || x.CanHandleWorkflowRequests))))
            .OrderBy(u => u.FullName).Select(u => new ReportOption(u.Id, u.FullName, u.CompanyId, process.AreaId)).ToListAsync(ct);
    }

    public static string StatusLabel(ProcessStatus status) => status switch {
        ProcessStatus.Draft => "Rascunho", ProcessStatus.InReview => "Em análise", ProcessStatus.Returned => "Devolvido",
        ProcessStatus.Approved => "Aprovado", ProcessStatus.Rejected => "Rejeitado", ProcessStatus.Finished => "Concluído",
        ProcessStatus.AdministrativeCancellation => "Cancelado administrativamente", _ => status.ToString() };
}
