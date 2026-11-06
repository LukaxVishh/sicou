using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Integrations;

namespace Sicou.Infrastructure.Automations;

public class AutomationMonitorWorker(IServiceScopeFactory scopes, IConfiguration config, ILogger<AutomationMonitorWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(Math.Clamp(config.GetValue<int?>("Automations:ScanIntervalSeconds") ?? 30, 1, 300));
        using var timer = new PeriodicTimer(interval);
        var nextCleanup = DateTime.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<AutomationService>().ScanAsync(stoppingToken);
                if (DateTime.UtcNow >= nextCleanup)
                {
                    var cutoff = DateTime.UtcNow.AddDays(-Math.Clamp(config.GetValue<int?>("Integrations:CallRetentionDays") ?? 90, 7, 3650));
                    await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Set<IntegrationCall>()
                        .Where(c => c.CreatedAt < cutoff).ExecuteDeleteAsync(stoppingToken);
                    nextCleanup = DateTime.UtcNow.AddHours(1);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Falha na verificação de automações; nova tentativa no próximo ciclo."); }
            try { if (!await timer.WaitForNextTickAsync(stoppingToken)) break; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
