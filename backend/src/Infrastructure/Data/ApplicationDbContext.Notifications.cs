using Microsoft.EntityFrameworkCore;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;

namespace Sicou.Infrastructure.Data;

public partial class ApplicationDbContext
{
    public DbSet<UserNotification> Notifications => Set<UserNotification>();

    private record NotificationEvent(Guid? CompanyId, Guid? AreaId, Guid? ProcessId,
        string Audience, string Title, string Url);

    // Notifications are inserted in the same SaveChanges transaction as the action.
    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        if (Guid.TryParse(_notificationActor?.UserId, out var actorId))
        {
            ChangeTracker.DetectChanges();
            var events = await CollectEventsAsync();
            var actor = await Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == actorId && u.IsActive, cancellationToken);
            if (actor != null)
            {
                foreach (var change in events.DistinctBy(e => new { e.CompanyId, e.AreaId, e.ProcessId, e.Audience, e.Title, e.Url }))
                {
                    // A general notice is general within its company, never across tenants.
                    if (!change.CompanyId.HasValue) continue;
                    var recipients = await EligibleNotificationUsers(change.CompanyId, change.AreaId, change.ProcessId, change.Audience)
                        .Where(u => u.Id != actorId).Select(u => u.Id).ToListAsync(cancellationToken);
                    var pendingProcess = ProcessInstances.Local.FirstOrDefault(p => p.Id == change.ProcessId);
                    if (change.Audience == "process" && pendingProcess != null)
                    {
                        var additional = await Users.Where(u => u.IsActive && u.CompanyId == change.CompanyId && u.Id != actorId
                            && (u.Id.ToString() == pendingProcess.CreatedByUserId
                                || (pendingProcess.Status != ProcessStatus.Draft && u.UnitId.HasValue && u.UnitId == pendingProcess.OriginUnitId)))
                            .Select(u => u.Id).ToListAsync(cancellationToken);
                        recipients = recipients.Concat(additional).Distinct().ToList();
                    }
                    Notifications.AddRange(recipients.Select(id => new UserNotification
                    {
                        UserId = id, CompanyId = change.CompanyId, AreaId = change.AreaId,
                        ProcessInstanceId = change.ProcessId, Audience = change.Audience,
                        Title = change.Title, Url = change.Url
                    }));
                }
            }
        }
        return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private IQueryable<Identity.ApplicationUser> EligibleNotificationUsers(Guid? companyId, Guid? areaId, Guid? processId, string audience)
    {
        var query = Users.AsNoTracking().Where(u => u.IsActive && (!u.CompanyId.HasValue || Companies.Any(c => c.Id == u.CompanyId && c.IsActive)));
        var admins = UserRoles.Where(ur => Roles.Any(r => r.Id == ur.RoleId && r.Name == SystemRoles.CompanyAdmin)).Select(ur => ur.UserId);
        var supers = UserRoles.Where(ur => Roles.Any(r => r.Id == ur.RoleId && r.Name == SystemRoles.SuperAdmin)).Select(ur => ur.UserId);
        query = query.Where(u => companyId.HasValue && u.CompanyId == companyId);
        if (!areaId.HasValue) return query;
        query = query.Where(u => Areas.Any(a => a.Id == areaId && a.IsActive && a.Company.IsActive)
            && (supers.Contains(u.Id) || (u.CompanyId == companyId && admins.Contains(u.Id))
            || UserAreaAccesses.Any(a => a.AreaId == areaId && a.CompanyId == companyId && a.UserId == u.Id.ToString() && a.IsActive
                && (audience == "guide-managers" ? a.CanManageGuide || a.CanManage
                    : audience == "guide-readers" ? a.CanView || a.CanManageGuide || a.CanManage
                    : audience == "workflow-managers" ? a.CanManageWorkflows || a.CanManage
                    : audience == "process" ? !u.UnitId.HasValue && (a.CanHandleWorkflowRequests || a.CanManage || a.CanView)
                    : a.CanView || a.CanManage || a.CanPublishInformatives || a.CanManageGuide || a.CanManageWorkflows || a.CanHandleWorkflowRequests))
            || (audience == "process" && ProcessInstances.Any(p => p.Id == processId && p.CompanyId == u.CompanyId
                && (p.CreatedByUserId == u.Id.ToString() || (u.UnitId.HasValue && p.OriginUnitId == u.UnitId && p.Status != ProcessStatus.Draft))))));
        return query;
    }

    private async Task<List<NotificationEvent>> CollectEventsAsync()
    {
        var result = new List<NotificationEvent>();
        var changes = ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList();
        foreach (var entry in changes)
        {
            var verb = entry.State == EntityState.Added ? "criado" : entry.State == EntityState.Deleted ? "excluído" : "atualizado";
            Guid? areaId = null;
            string? title = null;
            string audience = "area";
            string path = "/app/home";
            Guid? processId = null;
            switch (entry.Entity)
            {
                case Post post:
                    result.Add(new(post.CompanyId, post.CompanyId.HasValue ? post.AreaId : null, null, "area", $"Comunicado {verb}",
                        post.AreaId.HasValue ? $"/app/feed?areaId={post.AreaId}" : "/app/feed"));
                    continue;
                case GuideItem item:
                    areaId = item.AreaId;
                    var itemName = NotificationName(item.Title);
                    if (entry.State == EntityState.Added)
                        title = item.IsPublished ? $"Orientador: nova orientação {itemName}" : $"Orientador: novo rascunho {itemName}";
                    else if (entry.State == EntityState.Deleted)
                        title = $"Orientador: orientação removida {itemName}";
                    else if (entry.Property(nameof(GuideItem.IsPublished)).IsModified)
                        title = item.IsPublished ? $"Orientador: orientação publicada {itemName}" : $"Orientador: orientação retirada de publicação {itemName}";
                    else if (entry.Property(nameof(GuideItem.FileData)).IsModified || entry.Property(nameof(GuideItem.FileName)).IsModified)
                    {
                        var previousFile = entry.Property(nameof(GuideItem.FileName)).OriginalValue as string;
                        var fileAction = item.FileName == null ? "removido" : previousFile == null ? "adicionado" : "atualizado";
                        title = $"Orientador: anexo {fileAction} na orientação {itemName}";
                    }
                    else title = $"Orientador: orientação atualizada {itemName}";
                    audience = item.IsPublished ? "guide-readers" : "guide-managers";
                    path = $"/app/guide?areaId={areaId}"; break;
                case GuideCategory category:
                    areaId = category.AreaId;
                    var categoryAction = entry.State == EntityState.Added ? "nova categoria" : entry.State == EntityState.Deleted ? "categoria removida" : "categoria atualizada";
                    title = $"Orientador: {categoryAction} {NotificationName(category.Name)}";
                    audience = "guide-readers";
                    path = $"/app/guide?areaId={areaId}"; break;
                case ProcessInstance process:
                    areaId = process.AreaId; processId = process.Id; audience = "process";
                    title = $"Processo {verb}"; path = $"/app/workflows?areaId={areaId}"; break;
                case ProcessHistory history:
                    // Changes to an instance already produce one event; comments need their own event.
                    if (changes.Any(c => c.Entity is ProcessInstance p && p.Id == history.ProcessInstanceId)) continue;
                    var instance = ProcessInstances.Local.FirstOrDefault(p => p.Id == history.ProcessInstanceId)
                        ?? await ProcessInstances.AsNoTracking().FirstOrDefaultAsync(p => p.Id == history.ProcessInstanceId);
                    if (instance == null) continue;
                    areaId = instance.AreaId; processId = instance.Id; audience = "process";
                    title = "Nova atualização no processo"; path = $"/app/workflows?areaId={areaId}"; break;
                case ProcessType tree:
                    areaId = tree.AreaId; title = $"Árvore de workflow {verb}";
                    audience = "workflow-managers"; path = $"/app/workflows?areaId={areaId}"; break;
                case ProcessNode node:
                    areaId = node.AreaId; title = $"Etapa de workflow {verb}";
                    audience = "workflow-managers"; path = $"/app/workflows?areaId={areaId}"; break;
                case FieldDefinition field:
                    areaId = field.AreaId; title = $"Campo de workflow {verb}";
                    audience = "workflow-managers"; path = $"/app/workflows?areaId={areaId}"; break;
                case UserAreaAccess access:
                    areaId = access.AreaId; title = "Permissões da área atualizadas";
                    audience = "workflow-managers"; break;
                case AreaModule module:
                    areaId = module.AreaId; title = "Módulos da área atualizados"; break;
                case Area area:
                    areaId = area.Id; title = $"Área {verb}"; break;
            }
            if (!areaId.HasValue || title == null) continue;
            var linkedArea = Areas.Local.FirstOrDefault(a => a.Id == areaId)
                ?? await Areas.AsNoTracking().FirstOrDefaultAsync(a => a.Id == areaId);
            if (linkedArea != null)
            {
                var areaTitle = $"{title} · {ShortNotificationText(linkedArea.Name, 80)}";
                result.Add(new(linkedArea.CompanyId, areaId, processId, audience, areaTitle[..Math.Min(areaTitle.Length, 250)], path));
            }
        }
        return result;
    }

    private static string ShortNotificationText(string value, int limit)
    {
        var text = string.Join(" ", value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return text.Length <= limit ? text : text[..(limit - 1)] + "…";
    }

    private static string NotificationName(string value) => $"“{ShortNotificationText(value, 90)}”";

    public IQueryable<UserNotification> VisibleNotifications(Identity.ApplicationUser user)
    {
        var admins = UserRoles.Where(ur => Roles.Any(r => r.Id == ur.RoleId && r.Name == SystemRoles.CompanyAdmin)).Select(ur => ur.UserId);
        var supers = UserRoles.Where(ur => Roles.Any(r => r.Id == ur.RoleId && r.Name == SystemRoles.SuperAdmin)).Select(ur => ur.UserId);
        return Notifications.Where(n => n.UserId == user.Id
            && n.CompanyId.HasValue && n.CompanyId == user.CompanyId
            && Companies.Any(c => c.Id == n.CompanyId && c.IsActive)
            && (!n.AreaId.HasValue || Areas.Any(a => a.Id == n.AreaId && a.IsActive && a.Company.IsActive)
                && (supers.Contains(user.Id) || admins.Contains(user.Id)
                || UserAreaAccesses.Any(a => a.AreaId == n.AreaId && a.CompanyId == n.CompanyId && a.UserId == user.Id.ToString() && a.IsActive
                    && (n.Audience == "guide-managers" ? a.CanManageGuide || a.CanManage
                        : n.Audience == "guide-readers" ? a.CanView || a.CanManageGuide || a.CanManage
                        : n.Audience == "workflow-managers" ? a.CanManageWorkflows || a.CanManage
                        : n.Audience == "process" ? !user.UnitId.HasValue && (a.CanHandleWorkflowRequests || a.CanManage || a.CanView)
                        : a.CanView || a.CanManage || a.CanPublishInformatives || a.CanManageGuide || a.CanManageWorkflows || a.CanHandleWorkflowRequests))
                || (n.Audience == "process" && ProcessInstances.Any(p => p.Id == n.ProcessInstanceId && p.CompanyId == user.CompanyId
                    && (p.CreatedByUserId == user.Id.ToString() || (user.UnitId.HasValue && p.OriginUnitId == user.UnitId && p.Status != ProcessStatus.Draft)))))));
    }
}
