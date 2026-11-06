using System.Diagnostics;
using System.Security.Claims;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Integrations;

namespace Sicou.Api.Integrations;

public class IntegrationAccessMiddleware(RequestDelegate next, ILogger<IntegrationAccessMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context, IServiceScopeFactory scopes)
    {
        if (!Guid.TryParse(context.User.FindFirstValue("integration_token_id"), out var tokenId))
        {
            await next(context);
            return;
        }
        var timer = Stopwatch.StartNew();
        var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "unmapped";
        var userId = Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        context.Response.OnCompleted(async () =>
        {
            // Separate context: do not persist unrelated tracked business changes after errors.
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.Set<IntegrationCall>().Add(new IntegrationCall
                {
                    TokenId = tokenId, UserId = userId,
                    Method = context.Request.Method, Route = route.Length > 300 ? route[..300] : route,
                    StatusCode = context.Response.StatusCode, DurationMs = timer.ElapsedMilliseconds
                });
                await db.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception ex) { logger.LogError(ex, "Falha ao registrar chamada de integração {TokenId}", tokenId); }
        });
        var required = IntegrationRoutes.RequiredScope(context.Request.Method, route);
        if (required is null || !context.User.HasClaim("integration_scope", required))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { message = "Rota não liberada ou escopo ausente no token de integração." });
            return;
        }
        await next(context);
    }
}
