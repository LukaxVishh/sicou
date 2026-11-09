using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;

namespace Sicou.Api.Integrations;

/// <summary>
/// Registra no log de auditoria (UC-020, passo 5) cada chamada autenticada por token de integração:
/// integração, método, template da rota, processo afetado, status final e duração. Corpo, query string
/// e cabeçalhos não são gravados. A gravação ocorre no término da resposta, em escopo próprio, para que uma
/// falha de auditoria não desfaça a operação de negócio.
/// </summary>
public sealed class IntegrationCallAuditMiddleware(RequestDelegate next, ILogger<IntegrationCallAuditMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments(IntegrationAuth.RoutePrefix))
        {
            await next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        var scopeFactory = context.RequestServices.GetRequiredService<IServiceScopeFactory>();
        context.Response.OnCompleted(async () =>
        {
            var tokenClaim = context.User.FindFirst(IntegrationAuth.TokenIdClaim)?.Value;
            if (!Guid.TryParse(tokenClaim, out var tokenId))
                return; // Tokens inválidos não são atribuídos a nenhuma integração.

            var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "(rota desconhecida)";
            Guid? processId = context.GetRouteValue("id") is string raw && Guid.TryParse(raw, out var parsed)
                && route.Contains("processes/{id", StringComparison.Ordinal) ? parsed : null;

            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.IntegrationCalls.Add(new IntegrationCall
                {
                    TokenId = tokenId,
                    Method = context.Request.Method,
                    Route = route.Length > 300 ? route[..300] : route,
                    ProcessInstanceId = processId,
                    StatusCode = context.Response.StatusCode,
                    DurationMs = stopwatch.ElapsedMilliseconds,
                    CreatedAt = DateTime.UtcNow
                });
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Falha ao registrar a auditoria da chamada de integração {Method} {Route}.", context.Request.Method, route);
            }
        });

        await next(context);
    }
}

/// <summary>Remove registros de chamadas mais antigos que <c>Integrations:CallRetentionDays</c> (padrão 90).</summary>
public sealed class IntegrationCallRetentionWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<IntegrationCallRetentionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var days = Math.Clamp(configuration.GetValue<int?>("Integrations:CallRetentionDays") ?? 90, 7, 3650);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var limit = DateTime.UtcNow.AddDays(-days);
                var removed = await db.IntegrationCalls.Where(c => c.CreatedAt < limit).ExecuteDeleteAsync(stoppingToken);
                if (removed > 0) logger.LogInformation("Retenção de integrações: {Count} chamadas antigas removidas.", removed);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning(ex, "Falha na limpeza de chamadas de integração."); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
