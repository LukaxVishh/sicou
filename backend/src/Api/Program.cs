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

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellation) =>
        await context.HttpContext.Response.WriteAsJsonAsync(new { message = "Muitas solicitações de recuperação. Aguarde alguns minutos e tente novamente." }, cancellation);
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
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Sicou API",
        Version = "v1",
        Description = "API do sistema Sicou"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Informe o token JWT no formato: Bearer {seu_token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

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
    });


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
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await dbContext.Database.MigrateAsync();
}

await IdentitySeeder.SeedRolesAsync(app.Services);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
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
app.UseAuthorization();
app.MapControllers();

app.Run();
