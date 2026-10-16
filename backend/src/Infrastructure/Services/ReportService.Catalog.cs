using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Services;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;

namespace Sicou.Infrastructure.Services;

public partial class ReportService
{
    private static readonly ReportColumn[] UnitColumns = [new("name", "Unidade"), new("code", "Código"), new("company", "Empresa"),
        new("city", "Cidade"), new("state", "UF"), new("status", "Situação"), new("users", "Usuários ativos", "number"), new("createdAt", "Criado em (UTC)", "date")];
    private static readonly ReportColumn[] UserColumns = [new("name", "Nome"), new("email", "E-mail"), new("company", "Empresa"),
        new("unit", "Unidade"), new("roles", "Perfis"), new("status", "Situação"), new("createdAt", "Criado em (UTC)", "date")];
    private static readonly ReportColumn[] GuideColumns = [new("title", "Orientação"), new("company", "Empresa"), new("area", "Setor"),
        new("category", "Categoria"), new("status", "Publicação"), new("fileName", "Anexo"), new("url", "Link"), new("summary", "Resumo"),
        new("createdAt", "Criado em (UTC)", "date"), new("updatedAt", "Atualizado em (UTC)", "date")];
    private static readonly Dictionary<string, string> RoleLabels = new() {
        [SystemRoles.SuperAdmin] = "Super Admin", [SystemRoles.CompanyAdmin] = "Admin da Empresa", [SystemRoles.AreaAdmin] = "Gestor de Área",
        [SystemRoles.HeadquarterUser] = "Usuário da Sede", [SystemRoles.UnitUser] = "Usuário da Unidade" };

    private IQueryable<Area> GuideAreas(Scope scope)
    {
        var areas = db.Areas.AsNoTracking().Where(a => a.IsActive && a.Company.IsActive
            && a.AreaModules.Any(m => m.IsActive && m.Enabled && m.Module.Code == ModuleCode.Guide));
        if (!scope.Super) areas = areas.Where(a => a.CompanyId == scope.Actor.CompanyId);
        if (!scope.Admin) areas = areas.Where(a => db.UserAreaAccesses.Any(x => x.AreaId == a.Id && x.CompanyId == a.CompanyId
            && x.UserId == current.UserId && x.UnitId == scope.Actor.UnitId && x.IsActive && (x.CanView || x.CanManageGuide || x.CanManage)));
        return areas;
    }

    private IQueryable<GuideItem> GuideItems(Scope scope, IQueryable<Area> areas) => db.Set<GuideItem>().AsNoTracking().Where(i => i.IsActive
        && areas.Any(a => a.Id == i.AreaId)
        && db.Set<GuideCategory>().Any(c => c.Id == i.CategoryId && c.AreaId == i.AreaId && c.IsActive)
        && (i.IsPublished || scope.Admin || db.UserAreaAccesses.Any(x => x.AreaId == i.AreaId && x.UserId == current.UserId
            && x.IsActive && x.UnitId == scope.Actor.UnitId && x.CompanyId == scope.Actor.CompanyId && (x.CanManage || x.CanManageGuide))));

    public async Task<CatalogReportOptions> GetCatalogOptionsAsync(CancellationToken ct)
    {
        var scope = await ScopeAsync();
        var guideAreas = GuideAreas(scope);
        var companies = await db.Companies.AsNoTracking().Where(c => c.IsActive
            && (scope.Super || (scope.Admin ? c.Id == scope.Actor.CompanyId : guideAreas.Any(a => a.CompanyId == c.Id))))
            .OrderBy(c => c.Name).Select(c => new ReportOption(c.Id, c.Name, null, null)).ToListAsync(ct);
        var areas = await guideAreas.OrderBy(a => a.Name).Select(a => new ReportOption(a.Id, a.Name, a.CompanyId, null)).ToListAsync(ct);
        var units = scope.Admin ? await db.Units.AsNoTracking().Where(u => u.Company.IsActive && (scope.Super || u.CompanyId == scope.Actor.CompanyId))
            .OrderBy(u => u.Name).Select(u => new ReportOption(u.Id, u.Name, u.CompanyId, null)).ToListAsync(ct) : [];
        // Categories without visible items are not offered, avoiding names of draft-only groups for readers.
        var visibleItems = GuideItems(scope, guideAreas);
        var categories = await (from c in db.Set<GuideCategory>().AsNoTracking()
            join a in guideAreas on c.AreaId equals a.Id
            where c.IsActive && visibleItems.Any(i => i.CategoryId == c.Id)
            orderby c.Name select new ReportOption(c.Id, c.Name, a.CompanyId, c.AreaId)).ToListAsync(ct);
        return new(scope.Admin ? ["units", "users", "guides"] : ["guides"], companies, areas, units, categories);
    }

    private static (DateTime? Start, DateTime? End) ValidateCatalog(string kind, CatalogReportFilter filter)
    {
        if (kind is not ("units" or "users" or "guides")) throw new ArgumentException("Tipo de relatório inválido.");
        if (filter.PageSize is < 1 or > 100 || filter.Page < 1 || filter.Page > int.MaxValue / filter.PageSize)
            throw new ArgumentException("Paginação inválida.");
        if (filter.StartDate > filter.EndDate || filter.EndDate == DateOnly.MaxValue) throw new ArgumentException("Período inválido.");
        if (kind != "guides" && (filter.AreaId.HasValue || filter.CategoryId.HasValue)) throw new ArgumentException("Setor e categoria são filtros de orientações.");
        if (kind != "users" && !string.IsNullOrWhiteSpace(filter.Role)) throw new ArgumentException("Perfil é um filtro de usuários.");
        if (kind != "units" && (!string.IsNullOrWhiteSpace(filter.City) || !string.IsNullOrWhiteSpace(filter.State))) throw new ArgumentException("Cidade e UF são filtros de unidades.");
        if (kind == "guides" && filter.UnitId.HasValue) throw new ArgumentException("Unidade não se aplica às orientações.");
        if (!string.IsNullOrEmpty(filter.Role) && !RoleLabels.ContainsKey(filter.Role)) throw new ArgumentException("Perfil inválido.");
        var statuses = kind == "guides" ? new[] { "published", "draft" } : new[] { "active", "inactive" };
        if (!string.IsNullOrEmpty(filter.Status) && !statuses.Contains(filter.Status)) throw new ArgumentException("Situação inválida para este relatório.");
        return (filter.StartDate?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            filter.EndDate?.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
    }

    public async Task<CatalogReportResult> GetCatalogAsync(string kind, CatalogReportFilter filter, bool exporting, CancellationToken ct)
    {
        var dates = ValidateCatalog(kind, filter);
        var scope = await ScopeAsync();
        if (kind != "guides" && !scope.Admin) throw new UnauthorizedAccessException("Relatórios de unidades e usuários são restritos a administradores.");
        var companyQuery = db.Companies.AsNoTracking().Where(c => c.IsActive && (scope.Super || c.Id == scope.Actor.CompanyId));
        if (filter.CompanyId.HasValue && !await companyQuery.AnyAsync(c => c.Id == filter.CompanyId, ct)) throw new UnauthorizedAccessException("Empresa fora do seu escopo.");
        if (filter.UnitId.HasValue && !await db.Units.AnyAsync(u => u.Id == filter.UnitId && companyQuery.Any(c => c.Id == u.CompanyId)
            && (!filter.CompanyId.HasValue || u.CompanyId == filter.CompanyId), ct)) throw new UnauthorizedAccessException("Unidade fora do seu escopo.");
        var skip = exporting ? 0 : (filter.Page - 1) * filter.PageSize;
        var take = exporting ? 5001 : filter.PageSize;
        var search = filter.Search?.Trim().ToLowerInvariant();
        var items = new List<CatalogReportRow>();
        int total;
        ReportColumn[] columns;
        if (kind == "units")
        {
            columns = UnitColumns;
            var query = db.Units.AsNoTracking().Where(u => companyQuery.Any(c => c.Id == u.CompanyId));
            if (filter.CompanyId.HasValue) query = query.Where(u => u.CompanyId == filter.CompanyId);
            if (filter.UnitId.HasValue) query = query.Where(u => u.Id == filter.UnitId);
            if (filter.Status == "active") query = query.Where(u => u.IsActive);
            if (filter.Status == "inactive") query = query.Where(u => !u.IsActive);
            if (dates.Start.HasValue) query = query.Where(u => u.CreatedAt >= dates.Start);
            if (dates.End.HasValue) query = query.Where(u => u.CreatedAt < dates.End);
            if (!string.IsNullOrEmpty(search)) query = query.Where(u => u.Name.ToLower().Contains(search) || (u.Code != null && u.Code.ToLower().Contains(search)));
            if (!string.IsNullOrWhiteSpace(filter.City)) { var city = filter.City.Trim().ToLowerInvariant(); query = query.Where(u => u.City != null && u.City.ToLower().Contains(city)); }
            if (!string.IsNullOrWhiteSpace(filter.State)) { var state = filter.State.Trim().ToUpperInvariant(); query = query.Where(u => u.State != null && u.State.ToUpper() == state); }
            total = await query.CountAsync(ct);
            var rows = await query.OrderBy(u => u.Company.Name).ThenBy(u => u.Name).ThenBy(u => u.Id).Skip(skip).Take(take)
                .Select(u => new { u.Id, u.Name, u.Code, Company = u.Company.Name, u.City, u.State, u.IsActive, u.CreatedAt,
                    Users = db.Users.Count(x => x.CompanyId == u.CompanyId && x.UnitId == u.Id && x.IsActive) }).ToListAsync(ct);
            items.AddRange(rows.Select(u => new CatalogReportRow(u.Id, new Dictionary<string, object?> {
                ["name"] = u.Name, ["code"] = u.Code, ["company"] = u.Company, ["city"] = u.City, ["state"] = u.State,
                ["status"] = u.IsActive ? "Ativa" : "Inativa", ["users"] = u.Users, ["createdAt"] = u.CreatedAt })));
        }
        else if (kind == "users")
        {
            columns = UserColumns;
            var query = db.Users.AsNoTracking().Where(u => (scope.Super && u.CompanyId == null) || companyQuery.Any(c => c.Id == u.CompanyId));
            if (filter.CompanyId.HasValue) query = query.Where(u => u.CompanyId == filter.CompanyId);
            if (filter.UnitId.HasValue) query = query.Where(u => u.UnitId == filter.UnitId);
            if (filter.Status == "active") query = query.Where(u => u.IsActive);
            if (filter.Status == "inactive") query = query.Where(u => !u.IsActive);
            if (dates.Start.HasValue) query = query.Where(u => u.CreatedAt >= dates.Start);
            if (dates.End.HasValue) query = query.Where(u => u.CreatedAt < dates.End);
            if (!string.IsNullOrEmpty(search)) query = query.Where(u => u.FullName.ToLower().Contains(search) || (u.Email != null && u.Email.ToLower().Contains(search)));
            if (!string.IsNullOrEmpty(filter.Role)) query = query.Where(u => db.UserRoles.Any(ur => ur.UserId == u.Id && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == filter.Role)));
            total = await query.CountAsync(ct);
            var rows = await query.OrderBy(u => u.FullName).ThenBy(u => u.Id).Skip(skip).Take(take).Select(u => new {
                u.Id, u.FullName, u.Email, u.IsActive, u.CreatedAt,
                Company = db.Companies.Where(c => c.Id == u.CompanyId).Select(c => c.Name).FirstOrDefault(),
                Unit = db.Units.Where(x => x.Id == u.UnitId && x.CompanyId == u.CompanyId).Select(x => x.Name).FirstOrDefault() }).ToListAsync(ct);
            var ids = rows.Select(u => u.Id).ToArray();
            var roles = await (from ur in db.UserRoles join r in db.Roles on ur.RoleId equals r.Id where ids.Contains(ur.UserId) select new { ur.UserId, r.Name }).ToListAsync(ct);
            items.AddRange(rows.Select(u => new CatalogReportRow(u.Id, new Dictionary<string, object?> {
                ["name"] = u.FullName, ["email"] = u.Email, ["company"] = u.Company ?? "Plataforma", ["unit"] = u.Unit ?? "Sede",
                ["roles"] = string.Join(", ", roles.Where(r => r.UserId == u.Id).Select(r => RoleLabels.GetValueOrDefault(r.Name ?? "", r.Name ?? "")).Order()),
                ["status"] = u.IsActive ? "Ativo" : "Inativo", ["createdAt"] = u.CreatedAt })));
        }
        else
        {
            columns = GuideColumns;
            var areas = GuideAreas(scope);
            if (filter.CompanyId.HasValue && !await areas.AnyAsync(a => a.CompanyId == filter.CompanyId, ct)) throw new UnauthorizedAccessException("Empresa sem setores do Orientador no seu escopo.");
            if (filter.AreaId.HasValue && !await areas.AnyAsync(a => a.Id == filter.AreaId && (!filter.CompanyId.HasValue || a.CompanyId == filter.CompanyId), ct)) throw new UnauthorizedAccessException("Setor fora do seu escopo.");
            var query = GuideItems(scope, areas);
            if (filter.CompanyId.HasValue) query = query.Where(i => areas.Any(a => a.Id == i.AreaId && a.CompanyId == filter.CompanyId));
            if (filter.AreaId.HasValue) query = query.Where(i => i.AreaId == filter.AreaId);
            if (filter.CategoryId.HasValue)
            {
                if (!await query.AnyAsync(i => i.CategoryId == filter.CategoryId, ct)) throw new UnauthorizedAccessException("Categoria fora do recorte permitido.");
                query = query.Where(i => i.CategoryId == filter.CategoryId);
            }
            if (filter.Status == "published") query = query.Where(i => i.IsPublished);
            if (filter.Status == "draft") query = query.Where(i => !i.IsPublished);
            if (dates.Start.HasValue) query = query.Where(i => i.CreatedAt >= dates.Start);
            if (dates.End.HasValue) query = query.Where(i => i.CreatedAt < dates.End);
            if (!string.IsNullOrEmpty(search)) query = query.Where(i => i.Title.ToLower().Contains(search) || i.Content.ToLower().Contains(search));
            total = await query.CountAsync(ct);
            var rows = await (from i in query join a in areas on i.AreaId equals a.Id join c in db.Set<GuideCategory>() on i.CategoryId equals c.Id
                orderby a.Company.Name, a.Name, i.Title, i.Id
                select new { i.Id, i.Title, Company = a.Company.Name, Area = a.Name, Category = c.Name, i.IsPublished, i.FileName, i.Url,
                    Summary = i.Content.Length > 500 ? i.Content.Substring(0, 500) : i.Content, i.CreatedAt, i.UpdatedAt }).Skip(skip).Take(take).ToListAsync(ct);
            items.AddRange(rows.Select(i => new CatalogReportRow(i.Id, new Dictionary<string, object?> {
                ["title"] = i.Title, ["company"] = i.Company, ["area"] = i.Area, ["category"] = i.Category,
                ["status"] = i.IsPublished ? "Publicada" : "Rascunho", ["fileName"] = i.FileName ?? "Sem anexo", ["url"] = i.Url,
                ["summary"] = i.Summary, ["createdAt"] = i.CreatedAt, ["updatedAt"] = i.UpdatedAt })));
        }
        if (exporting && items.Count > 5000) throw new ArgumentException("A exportação permite até 5.000 registros. Refine os filtros.");
        return new(columns, items, total, filter.Page, filter.PageSize);
    }

    public async Task<ReportFile> ExportCatalogAsync(string kind, CatalogReportFilter filter, string format, CancellationToken ct)
    {
        if (format is not ("pdf" or "xlsx" or "csv")) throw new ArgumentException("Formato inválido.");
        var result = await GetCatalogAsync(kind, filter, true, ct);
        var title = kind switch { "units" => "Relatório de unidades", "users" => "Relatório de usuários", _ => "Relatório de orientações" };
        return ReportExporter.ExportData(result.Items, result.Columns.ToArray(), filter.Columns, format, kind, title, filter.StartDate, filter.EndDate);
    }
}
