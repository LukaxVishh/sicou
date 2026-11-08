using System.Text;
using Sicou.Api.Middlewares;
using Sicou.Domain.Constants;
using Microsoft.OpenApi.Models;
using Sicou.Infrastructure.Seed;
using System.Text.Json.Serialization;
using Microsoft.IdentityModel.Tokens;
using Sicou.Infrastructure.Extensions;
using Sicou.Infrastructure.Authorization;
using Sicou.Infrastructure.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Sicou.Infrastructure.Data;
using Microsoft.Extensions.FileProviders;
using Sicou.Api.Integrations;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellation) =>
    {
        var isIntegration = context.HttpContext.Request.Path.StartsWithSegments(IntegrationAuth.RoutePrefix);
        if (isIntegration) context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            message = isIntegration
                ? "Limite de chamadas por minuto deste token excedido. Aguarde e tente novamente."
                : "Muitas solicitações de recuperação. Aguarde alguns minutos e tente novamente.",
            statusCode = StatusCodes.Status429TooManyRequests
        }, cancellation);
    };
    // Integrações: limite por token (hash do segredo), em memória e por instância da API.
    options.AddPolicy(IntegrationAuth.RateLimitPolicy, context =>
    {
        string? header = context.Request.Headers.Authorization;
        var secret = header?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true ? header[7..].Trim() : header?.Trim();
        var key = !string.IsNullOrEmpty(secret) && secret.StartsWith("sic_", StringComparison.Ordinal)
            ? "token:" + Sicou.Infrastructure.Services.IntegrationTokenService.HashSecret(secret)
            : "ip:" + context.Connection.RemoteIpAddress;
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(key,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = Math.Clamp(builder.Configuration.GetValue<int?>("Integrations:RequestsPerMinute") ?? 120, 1, 10000),
                Window = TimeSpan.FromMinutes(1), QueueLimit = 0
            });
    });
    options.AddPolicy("email-password-recovery", context =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            $"{context.Connection.RemoteIpAddress}:{context.Request.Path.Value?.ToLowerInvariant()}",
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = Math.Clamp(builder.Configuration.GetValue<int?>("Email:RequestLimit") ?? 5, 1, 100),
                Window = TimeSpan.FromMinutes(15), QueueLimit = 0
            }));
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddCorsConfiguration(builder.Configuration);
builder.Services.AddSwaggerGen(IntegrationSwagger.Configure);
builder.Services.AddHostedService<IntegrationCallRetentionWorker>();

var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

if (string.IsNullOrWhiteSpace(jwtKey))
    throw new InvalidOperationException("JWT Key is not configured.");

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var users = context.HttpContext.RequestServices.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<Sicou.Infrastructure.Identity.ApplicationUser>>();
                var userId = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var user = await users.FindByIdAsync(userId ?? string.Empty);
                var stamp = context.Principal?.FindFirst("security_stamp")?.Value;
                if (user is null || !user.IsActive || string.IsNullOrEmpty(stamp) || stamp != user.SecurityStamp
                    || (user.MustChangePassword && (!user.TemporaryPasswordExpiresAt.HasValue || user.TemporaryPasswordExpiresAt <= DateTime.UtcNow)))
                    context.Fail("Sessão inválida. Faça login novamente.");
                else context.HttpContext.Items["MustChangePassword"] = user.MustChangePassword;
            }
        };

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            ValidateAudience = true,
            ValidAudience = jwtAudience,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)
            ),

            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    })
    .AddIntegrationTokens();


builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(SystemPolicies.CanViewArea, policy =>
        policy.Requirements.Add(new AreaPermissionRequirement(SystemPolicies.CanViewArea)));

    options.AddPolicy(SystemPolicies.CanManageArea, policy =>
        policy.Requirements.Add(new AreaPermissionRequirement(SystemPolicies.CanManageArea)));

    options.AddPolicy(SystemPolicies.CanPublishInformative, policy =>
        policy.Requirements.Add(new AreaPermissionRequirement(SystemPolicies.CanPublishInformative)));

    options.AddPolicy(SystemPolicies.CanManageGuide, policy =>
        policy.Requirements.Add(new AreaPermissionRequirement(SystemPolicies.CanManageGuide)));

    options.AddPolicy(SystemPolicies.CanManageWorkflow, policy =>
        policy.Requirements.Add(new AreaPermissionRequirement(SystemPolicies.CanManageWorkflow)));

    options.AddPolicy(SystemPolicies.CanHandleWorkflow, policy =>
        policy.Requirements.Add(new AreaPermissionRequirement(SystemPolicies.CanHandleWorkflow)));

    options.AddIntegrationScopePolicies();
});

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await dbContext.Database.MigrateAsync();
}

await IdentitySeeder.SeedRolesAsync(app.Services);
await HrHiringWorkflowSeeder.SeedAsync(app.Services);

// Swagger completo: somente em Development. Swagger de integrações: Development ou Integrations:SwaggerEnabled=true.
var fullSwagger = app.Environment.IsDevelopment();
var integrationSwagger = fullSwagger || app.Configuration.GetValue<bool>("Integrations:SwaggerEnabled");
if (integrationSwagger)
{
    if (!fullSwagger)
    {
        // Fora de Development, publica apenas o documento de integrações.
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/swagger")
                && !context.Request.Path.StartsWithSegments($"/swagger/{IntegrationSwagger.DocumentName}"))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }
            await next(context);
        });
    }
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.RoutePrefix = IntegrationSwagger.UiRoutePrefix;
        options.DocumentTitle = "Sicou — API de Integração de Workflows";
        options.SwaggerEndpoint($"/swagger/{IntegrationSwagger.DocumentName}/swagger.json", "Integração de Workflows (token sic_)");
        options.DisplayRequestDuration();
    });
}
if (fullSwagger)
{
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint($"/swagger/{IntegrationSwagger.FullDocumentName}/swagger.json", "Sicou API completa (JWT)");
        options.SwaggerEndpoint($"/swagger/{IntegrationSwagger.DocumentName}/swagger.json", "Integração de Workflows (token sic_)");
    });
}


var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
if (!Directory.Exists(uploadsPath))
{
    Directory.CreateDirectory(uploadsPath);
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});
app.UseRouting();
app.UseCorsConfiguration();
app.UseRateLimiter();
app.UseAuthentication();
app.Use(async (context, next) =>
{
    if (context.Items["MustChangePassword"] is true
        && !context.Request.Path.Equals(new PathString("/api/auth/me"))
        && !context.Request.Path.Equals(new PathString("/api/auth/change-password")))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { message = "Defina sua senha definitiva antes de acessar o sistema.", mustChangePassword = true });
        return;
    }
    await next(context);
});
app.UseMiddleware<IntegrationCallAuditMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.Run();
