using System.ComponentModel.DataAnnotations;

namespace Sicou.Infrastructure.Automations;

public class Automation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? CompanyId { get; set; }
    public Guid? UnitId { get; set; }
    public string Name { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int HeartbeatTimeoutSeconds { get; set; } = 120;
    public int MaxRunMinutes { get; set; } = 60;
    public int? ExpectedIntervalMinutes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ScheduleBaselineAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastStartedAt { get; set; }
    public DateTime? OverdueAlertedAt { get; set; }
}

public class AutomationRun
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AutomationId { get; set; }
    public Guid ExternalId { get; set; }
    public string Status { get; set; } = "Running";
    public string Host { get; set; } = "";
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastHeartbeatAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }
    public int? ExitCode { get; set; }
    public string? Message { get; set; }
    public string? Logs { get; set; }
    public DateTime? DurationAlertedAt { get; set; }
    // Snapshot: editing a definition must not change a running execution's deadline.
    public int HeartbeatTimeoutSeconds { get; set; }
    public int MaxRunMinutes { get; set; }
}

public class AutomationAlert
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AutomationId { get; set; }
    public Guid? RunId { get; set; }
    public string Kind { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcknowledgedAt { get; set; }
}

public record AutomationSettings(
    [Required, StringLength(100, MinimumLength = 1)] string Name,
    [Range(30, 3600)] int HeartbeatTimeoutSeconds = 120,
    [Range(1, 1440)] int MaxRunMinutes = 60,
    [Range(1, 10080)] int? ExpectedIntervalMinutes = null,
    bool IsActive = true);
public record StartAutomationRunRequest(Guid ExternalId, [StringLength(100)] string Host = "");
public record CompleteAutomationRunRequest([property: System.Text.Json.Serialization.JsonRequired] bool Succeeded,
    int? ExitCode = null, [StringLength(2000)] string? Message = null, [StringLength(16000)] string? Logs = null);
public record AutomationRunResponse(Guid Id, Guid AutomationId, Guid ExternalId, string Status, string Host,
    DateTime StartedAt, DateTime LastHeartbeatAt, DateTime? FinishedAt, long? DurationMs,
    int? ExitCode, string? Message, string? Logs, DateTime? DurationAlertedAt);
public record AutomationSummaryResponse(int Running, int Succeeded, int Failed, int UnacknowledgedAlerts);
public record AutomationDashboardResponse(IReadOnlyList<Automation> Automations, AutomationSummaryResponse Summary, IReadOnlyList<AutomationAlert> Alerts);
public record AutomationHistoryResponse(int Total, IReadOnlyList<AutomationRunResponse> Items);
public class AutomationConflictException(string message) : Exception(message);
