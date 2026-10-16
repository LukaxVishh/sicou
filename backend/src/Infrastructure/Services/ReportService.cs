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

    private async Task<List<ReportRow>> RowsAsync(IQueryable<ProcessInstance> query, Scope scope, CancellationToken ct)
    {
        var data = await (from p in query
            join u in db.Users on p.ResponsibleUserId equals (Guid?)u.Id into assigned
            from u in assigned.DefaultIfEmpty()
            select new { p.Id, p.CompanyId, p.AreaId, p.OriginUnitId, p.ProcessNumber, p.Title, Company = p.Company.Name, Area = p.Area.Name,
                Unit = p.OriginUnit == null ? "Sede" : p.OriginUnit.Name, ProcessType = p.ProcessType.Name,
                p.Status, p.ResponsibleUserId, Responsible = u == null ? "Sem responsável" : u.FullName,
                p.CreatedByUserName, p.CreatedAt, p.UpdatedAt,
                CanAssign = scope.Admin || db.UserAreaAccesses.Any(x => x.UserId == current.UserId && x.IsActive
                    && x.CompanyId == p.CompanyId && x.AreaId == p.AreaId && x.UnitId == scope.Actor.UnitId
                    && (x.CanManage || x.CanManageWorkflows)) }).ToListAsync(ct);
        return data.Select(p => new ReportRow(p.Id, p.CompanyId, p.AreaId, p.OriginUnitId, p.ProcessNumber, p.Title ?? "", p.Company, p.Area, p.Unit,
            p.ProcessType, StatusLabel(p.Status), p.ResponsibleUserId, p.Responsible, p.CreatedByUserName ?? "",
            p.CreatedAt, p.UpdatedAt, p.CanAssign)).ToList();
    }

    public async Task<ReportResult> GetAsync(ReportFilter filter, CancellationToken ct)
    {
        if (filter.Page < 1 || filter.PageSize is < 1 or > 100 || filter.Page > int.MaxValue / filter.PageSize)
            throw new ArgumentException("Paginação inválida.");
        var scope = await ScopeAsync();
        var query = await FilterAsync(scope, filter, ct);
        var total = await query.CountAsync(ct);
        var rows = await RowsAsync(query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id)
            .Skip((filter.Page - 1) * filter.PageSize).Take(filter.PageSize), scope, ct);
        return new(rows, total, filter.Page, filter.PageSize);
    }

    public async Task<ReportFile> ExportAsync(ReportFilter filter, string format, CancellationToken ct)
    {
        if (format is not ("csv" or "xlsx" or "pdf")) throw new ArgumentException("Formato inválido. Use PDF, XLSX ou CSV.");
        var scope = await ScopeAsync();
        var query = await FilterAsync(scope, filter, ct);
        var rows = await RowsAsync(query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id).Take(5001), scope, ct);
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
