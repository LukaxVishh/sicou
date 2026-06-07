using System.Text;
using Sicou.Domain.Constants;
using Microsoft.OpenApi.Models;
using Sicou.Infrastructure.Seed;
using System.Text.Json.Serialization;
using Microsoft.IdentityModel.Tokens;
using Sicou.Infrastructure.Extensions;
using Sicou.Infrastructure.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddInfrastructure(builder.Configuration);
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

await IdentitySeeder.SeedRolesAsync(app.Services);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();