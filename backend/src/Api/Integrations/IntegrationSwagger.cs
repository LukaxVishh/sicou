using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Sicou.Domain.Constants;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Sicou.Api.Integrations;

/// <summary>Documento OpenAPI separado para a API de integração dos Workflows (RNF-014).</summary>
public static class IntegrationSwagger
{
    public const string DocumentName = "integrations";
    public const string FullDocumentName = "v1";
    public const string UiRoutePrefix = "integrations/docs";

    private const string SessionScheme = "Bearer";

    public static void Configure(SwaggerGenOptions options)
    {
        options.SwaggerDoc(FullDocumentName, new OpenApiInfo
        {
            Title = "Sicou API",
            Version = "v1",
            Description = "API completa do sistema Sicou, usada pela interface web (JWT de sessão)."
        });

        options.SwaggerDoc(DocumentName, new OpenApiInfo
        {
            Title = "Sicou — API de Integração de Workflows",
            Version = "v1",
            Description = BuildDescription()
        });

        options.DocInclusionPredicate((document, api) => document == DocumentName
            ? api.GroupName == DocumentName
            : api.GroupName != DocumentName);

        options.AddSecurityDefinition(SessionScheme, new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "Bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Informe o token JWT de sessão (obtido em /api/auth/login)."
        });

        options.AddSecurityDefinition(IntegrationAuth.Scheme, new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "Bearer",
            BearerFormat = "sic_",
            In = ParameterLocation.Header,
            Description = "Cole somente o segredo do token de integração (sic_...), sem a palavra Bearer."
        });

        // Comentários XML primeiro: o filtro de integrações acrescenta o escopo exigido à descrição já preenchida.
        var xml = Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
        if (File.Exists(xml)) options.IncludeXmlComments(xml, includeControllerXmlComments: true);
        options.OperationFilter<IntegrationOperationFilter>();
        options.DocumentFilter<IntegrationDocumentFilter>();
    }

    private static string BuildDescription()
    {
        return """
API para agentes e sistemas externos operarem os **Workflows** do Sicou.

Autentique com `Authorization: Bearer sic_...`, token emitido em **Integrações**. A integração acessa os dados da sua empresa, conforme os escopos concedidos.
""";
    }
}

internal sealed class IntegrationOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        if (context.DocumentName == IntegrationSwagger.DocumentName)
        {
            operation.Security = [Requirement(IntegrationAuth.Scheme)];
            var scopes = context.MethodInfo.GetCustomAttributes<RequireScopeAttribute>(true)
                .Concat(context.MethodInfo.DeclaringType?.GetCustomAttributes<RequireScopeAttribute>(true) ?? [])
                .Select(a => a.Scope).Distinct().ToList();
            if (scopes.Count > 0)
            {
                var text = $"**Escopo exigido:** {string.Join(", ", scopes.Select(s => $"`{s}`"))}";
                operation.Description = string.IsNullOrWhiteSpace(operation.Description) ? text : $"{text}\n\n{operation.Description}";
                var extension = new OpenApiArray();
                extension.AddRange(scopes.Select(scope => new OpenApiString(scope)));
                operation.Extensions["x-required-scopes"] = extension;
            }
            Describe(operation, "401", "Token ausente, inválido, expirado ou revogado.");
            Describe(operation, "403", "Escopo insuficiente ou sem permissão sobre o recurso.");
            Describe(operation, "429", "Limite de chamadas do token excedido.");
            Describe(operation, "400", null);
            Describe(operation, "404", null);
            return;
        }

        var anonymous = context.MethodInfo.GetCustomAttribute<AllowAnonymousAttribute>(true) is not null;
        if (!anonymous) operation.Security = [Requirement("Bearer")];
    }

    private static void Describe(OpenApiOperation operation, string code, string? description)
    {
        if (!operation.Responses.TryGetValue(code, out var response)) return;
        response.Description = description ?? code switch
        {
            "400" => "Dados inválidos ou regra do workflow não atendida.",
            "404" => "Recurso não encontrado.",
            _ => response.Description
        };
    }

    private static OpenApiSecurityRequirement Requirement(string scheme) => new()
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = scheme } }] = Array.Empty<string>()
    };
}

/// <summary>Mantém em cada documento apenas o esquema de segurança que ele usa.</summary>
internal sealed class IntegrationDocumentFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument document, DocumentFilterContext context)
    {
        var remove = context.DocumentName == IntegrationSwagger.DocumentName ? "Bearer" : IntegrationAuth.Scheme;
        document.Components.SecuritySchemes.Remove(remove);

        if (context.DocumentName == IntegrationSwagger.DocumentName)
        {
            // Descrições curtas por grupo, no lugar do resumo do controller repetido em todos os grupos.
            document.Tags = TagDescriptions
                .Select(t => new OpenApiTag { Name = t.Key, Description = t.Value })
                .ToList();
        }
    }

    private static readonly IReadOnlyList<KeyValuePair<string, string>> TagDescriptions =
    [
        new("Identidade", "Dados do token em uso."),
        new("Workflows", "Workflows disponíveis para abertura."),
        new("Processos — consulta", "Lista, detalhe, status e histórico."),
        new("Processos — abertura", "Abertura, rascunho e protocolo."),
        new("Processos — tramitação", "Avançar, devolver, reiniciar, comentar, cancelar e transferir.")
    ];
}
