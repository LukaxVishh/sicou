using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Automations;

public class AutomationService(ApplicationDbContext db, UserManager<ApplicationUser> users, ICurrentUserService current)
{
    // Match PostgreSQL microsecond precision, including the first response before re-read.
    private static DateTime Now() => new(DateTime.UtcNow.Ticks / 10 * 10, DateTimeKind.Utc);
    private async Task<ApplicationUser> ActorAsync(CancellationToken ct)
    {
        var user = await users.FindByIdAsync(current.UserId ?? "");
        if (user is null || !user.IsActive || user.MustChangePassword)
            throw new UnauthorizedAccessException("Usuário indisponível.");
        if (user.CompanyId.HasValue && !await db.Companies.AnyAsync(c => c.Id == user.CompanyId && c.IsActive, ct))
            throw new UnauthorizedAccessException("Empresa indisponível.");
        if (user.UnitId.HasValue && !await db.Units.AnyAsync(u => u.Id == user.UnitId && u.CompanyId == user.CompanyId && u.IsActive, ct))
            throw new UnauthorizedAccessException("Unidade indisponível.");
        return user;
    }

    private async Task<IQueryable<Automation>> VisibleAsync(CancellationToken ct)
    {
        var actor = await ActorAsync(ct);
        var query = db.Set<Automation>().AsNoTracking();
        if (await users.IsInRoleAsync(actor, SystemRoles.SuperAdmin)) return query;
        if (actor.CompanyId.HasValue && await users.IsInRoleAsync(actor, SystemRoles.CompanyAdmin))
            return query.Where(a => a.CompanyId == actor.CompanyId);
        return query.Where(a => a.UserId == actor.Id && a.CompanyId == actor.CompanyId && a.UnitId == actor.UnitId);
    }

    private async Task RequireOwnerAsync(Automation automation, CancellationToken ct)
    {
        var actor = await ActorAsync(ct);
        if (automation.UserId != actor.Id || automation.CompanyId != actor.CompanyId || automation.UnitId != actor.UnitId)
            throw new KeyNotFoundException("Automação não encontrada para este usuário e vínculo.");
    }

    // PostgreSQL row locks serialize start/heartbeat/completion/monitor across API replicas.
    private async Task<Automation> LockAsync(Guid id, CancellationToken ct) => await db.Set<Automation>()
        .FromSqlInterpolated($"SELECT * FROM automations WHERE \"Id\" = {id} FOR UPDATE")
        .SingleOrDefaultAsync(ct) ?? throw new KeyNotFoundException("Automação não encontrada.");

    public async Task<Automation> CreateAsync(AutomationSettings settings, CancellationToken ct)
    {
        var actor = await ActorAsync(ct);
        if (string.IsNullOrWhiteSpace(settings.Name)) throw new ArgumentException("Informe o nome da automação.");
        var entity = new Automation { UserId = actor.Id, CompanyId = actor.CompanyId, UnitId = actor.UnitId };
        Apply(entity, settings);
        db.Add(entity);
        await db.SaveChangesAsync(ct);
        return entity;
    }

    public async Task<Automation> UpdateAsync(Guid id, AutomationSettings settings, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(settings.Name)) throw new ArgumentException("Informe o nome da automação.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var entity = await LockAsync(id, ct);
        await RequireOwnerAsync(entity, ct);
        if (entity.IsActive != settings.IsActive || entity.ExpectedIntervalMinutes != settings.ExpectedIntervalMinutes)
        {
            entity.OverdueAlertedAt = null;
            entity.ScheduleBaselineAt = DateTime.UtcNow;
        }
        Apply(entity, settings);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return entity;
    }

    private static void Apply(Automation entity, AutomationSettings settings)
    {
        entity.Name = settings.Name.Trim(); entity.IsActive = settings.IsActive;
        entity.HeartbeatTimeoutSeconds = settings.HeartbeatTimeoutSeconds;
        entity.MaxRunMinutes = settings.MaxRunMinutes; entity.ExpectedIntervalMinutes = settings.ExpectedIntervalMinutes;
    }

    public async Task<AutomationDashboardResponse> DashboardAsync(Guid? companyId, CancellationToken ct)
    {
        var query = await VisibleAsync(ct);
        if (companyId.HasValue) query = query.Where(a => a.CompanyId == companyId);
        var definitions = await query.OrderByDescending(a => a.CreatedAt).Take(201).ToListAsync(ct);
        if (definitions.Count > 200) throw new ArgumentException("Mais de 200 automações visíveis. Selecione uma empresa ou reduza o cadastro.");
        var ids = definitions.Select(a => a.Id).ToArray();
        var since = DateTime.UtcNow.AddDays(-7);
        var runs = db.Set<AutomationRun>().AsNoTracking().Where(r => ids.Contains(r.AutomationId));
        var alerts = db.Set<AutomationAlert>().AsNoTracking().Where(a => ids.Contains(a.AutomationId));
        return new AutomationDashboardResponse(definitions, new AutomationSummaryResponse(
            await runs.CountAsync(r => r.Status == "Running", ct),
            await runs.CountAsync(r => r.StartedAt >= since && r.Status == "Succeeded", ct),
            await runs.CountAsync(r => r.StartedAt >= since && (r.Status == "Failed" || r.Status == "Interrupted"), ct),
            await alerts.CountAsync(a => a.AcknowledgedAt == null, ct)),
            await alerts.OrderByDescending(a => a.CreatedAt).ThenBy(a => a.Id).Take(50).ToListAsync(ct));
    }

    public async Task<AutomationHistoryResponse> HistoryAsync(Guid id, int page, int pageSize, string? status, CancellationToken ct)
    {
        if (!await (await VisibleAsync(ct)).AnyAsync(a => a.Id == id, ct)) throw new KeyNotFoundException("Automação não encontrada.");
        var query = db.Set<AutomationRun>().AsNoTracking().Where(r => r.AutomationId == id);
        if (!string.IsNullOrEmpty(status))
        {
            if (status is not ("Running" or "Succeeded" or "Failed" or "Interrupted")) throw new ArgumentException("Status inválido.");
            query = query.Where(r => r.Status == status);
        }
        var items = await query.OrderByDescending(r => r.StartedAt).ThenBy(r => r.Id)
            .Skip((int)Math.Min((long)(page - 1) * pageSize, int.MaxValue)).Take(pageSize).ToListAsync(ct);
        return new AutomationHistoryResponse(await query.CountAsync(ct), items.Select(Response).ToList());
    }

    public async Task<(AutomationRunResponse Run, bool Created)> StartAsync(Guid id, StartAutomationRunRequest request, CancellationToken ct)
    {
        if (request.ExternalId == Guid.Empty) throw new ArgumentException("externalId deve ser um UUID não vazio e único por execução.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var automation = await LockAsync(id, ct);
        await RequireOwnerAsync(automation, ct);
        var existing = await db.Set<AutomationRun>().SingleOrDefaultAsync(r => r.AutomationId == id && r.ExternalId == request.ExternalId, ct);
        if (existing != null)
        {
            if (existing.Host != (request.Host ?? "").Trim()) throw new AutomationConflictException("externalId já utilizado com outro host.");
            return (Response(existing), false);
        }
        if (!automation.IsActive) throw new AutomationConflictException("Automação pausada para novas execuções.");
        var now = Now();
        var run = new AutomationRun
        {
            AutomationId = id, ExternalId = request.ExternalId, Host = (request.Host ?? "").Trim(),
            StartedAt = now, LastHeartbeatAt = now,
            HeartbeatTimeoutSeconds = automation.HeartbeatTimeoutSeconds, MaxRunMinutes = automation.MaxRunMinutes
        };
        automation.LastStartedAt = now; automation.OverdueAlertedAt = null;
        db.Add(run);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (Response(run), true);
    }

    public async Task<AutomationRunResponse> UpdateRunAsync(Guid id, CompleteAutomationRunRequest? completion, CancellationToken ct)
    {
        var automationId = await db.Set<AutomationRun>().AsNoTracking().Where(r => r.Id == id).Select(r => (Guid?)r.AutomationId).SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Execução não encontrada.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var automation = await LockAsync(automationId, ct);
        await RequireOwnerAsync(automation, ct);
        var run = await db.Set<AutomationRun>().SingleAsync(r => r.Id == id, ct);
        var now = Now();
        if (run.Status == "Running" && DeadlineExceeded(run, now))
        {
            Interrupt(automation, run, now);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            throw new AutomationConflictException("Execução interrompida por ausência de atividade ou duração máxima.");
        }
        if (run.Status != "Running")
        {
            if (completion is not null && run.Status == (completion.Succeeded ? "Succeeded" : "Failed")
                && run.ExitCode == completion.ExitCode && run.Message == completion.Message?.Trim()) return Response(run);
            throw new AutomationConflictException("Execução já encerrada; o resultado não pode ser alterado.");
        }
        run.LastHeartbeatAt = now;
        if (completion is not null)
        {
            if (completion.Succeeded && completion.ExitCode is not null and not 0)
                throw new ArgumentException("Uma execução bem-sucedida não pode ter código de saída diferente de zero.");
            run.Status = completion.Succeeded ? "Succeeded" : "Failed";
            run.FinishedAt = now; run.ExitCode = completion.ExitCode; run.Message = completion.Message?.Trim();
            if (!completion.Succeeded) Alert(automation, run.Id, "Failure", "Execução terminou com falha.", now);
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Response(run);
    }

    public async Task AcknowledgeAsync(Guid id, CancellationToken ct)
    {
        var visible = await VisibleAsync(ct);
        var alert = await db.Set<AutomationAlert>().FirstOrDefaultAsync(a => a.Id == id && visible.Any(d => d.Id == a.AutomationId), ct)
            ?? throw new KeyNotFoundException("Alerta não encontrado.");
        alert.AcknowledgedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public static bool DeadlineExceeded(AutomationRun run, DateTime now) =>
        now >= run.LastHeartbeatAt.AddSeconds(run.HeartbeatTimeoutSeconds) || now >= run.StartedAt.AddMinutes(run.MaxRunMinutes);

    private void Interrupt(Automation automation, AutomationRun run, DateTime now)
    {
        run.Status = "Interrupted"; run.FinishedAt = now;
        run.Message = "Atividade interrompida ou duração máxima excedida.";
        Alert(automation, run.Id, "Interrupted", run.Message, now);
    }

    private void Alert(Automation automation, Guid? runId, string kind, string message, DateTime now)
    {
        db.Add(new AutomationAlert { AutomationId = automation.Id, RunId = runId, Kind = kind, Message = message, CreatedAt = now });
        db.Notifications.Add(new UserNotification
        {
            UserId = automation.UserId, CompanyId = automation.CompanyId, Audience = "automation",
            Title = $"Automação {automation.Name}: {message}", Url = "/app/integrations", CreatedAt = now
        });
    }

    public async Task ScanAsync(CancellationToken ct)
    {
        // Only active owners/bindings participate in automatic alerts. Running executions
        // remain subject to interruption even if their definition is paused.
        var eligible = db.Set<Automation>().AsNoTracking().Where(a => db.Users.Any(u => u.Id == a.UserId && u.IsActive
            && u.CompanyId == a.CompanyId && u.UnitId == a.UnitId)
            && (!a.CompanyId.HasValue || db.Companies.Any(c => c.Id == a.CompanyId && c.IsActive))
            && (!a.UnitId.HasValue || db.Units.Any(u => u.Id == a.UnitId && u.IsActive && u.CompanyId == a.CompanyId)));
        var ids = await db.Set<Automation>().Where(a => eligible.Any(e => e.Id == a.Id) && a.IsActive && a.ExpectedIntervalMinutes != null
            || db.Set<AutomationRun>().Any(r => r.AutomationId == a.Id && r.Status == "Running")).Select(a => a.Id).ToListAsync(ct);
        foreach (var id in ids)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var automation = await LockAsync(id, ct);
            var canSchedule = await eligible.AnyAsync(a => a.Id == id, ct);
            var now = Now();
            var running = await db.Set<AutomationRun>().Where(r => r.AutomationId == id && r.Status == "Running").ToListAsync(ct);
            foreach (var run in running.Where(r => DeadlineExceeded(r, now))) Interrupt(automation, run, now);
            if (canSchedule && automation.IsActive && automation.ExpectedIntervalMinutes is { } interval && automation.OverdueAlertedAt == null
                && now >= (automation.LastStartedAt > automation.ScheduleBaselineAt ? automation.LastStartedAt.Value : automation.ScheduleBaselineAt).AddMinutes(interval))
            {
                automation.OverdueAlertedAt = now;
                Alert(automation, null, "Overdue", "Nenhuma nova execução começou no intervalo esperado.", now);
            }
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();
        }
    }

    private static AutomationRunResponse Response(AutomationRun run) => new(run.Id, run.AutomationId, run.ExternalId,
        run.Status, run.Host, run.StartedAt, run.LastHeartbeatAt, run.FinishedAt,
        run.FinishedAt.HasValue ? (long)(run.FinishedAt.Value - run.StartedAt).TotalMilliseconds : null,
        run.ExitCode, run.Message);
}
