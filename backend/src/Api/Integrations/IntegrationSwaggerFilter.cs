using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Sicou.Api.Integrations;

public class IntegrationSwaggerFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var metadata = context.ApiDescription.ActionDescriptor.EndpointMetadata;
        if (metadata.OfType<AllowAnonymousAttribute>().Any() || !metadata.OfType<AuthorizeAttribute>().Any())
            operation.Security = new List<OpenApiSecurityRequirement>();
        var scope = IntegrationRoutes.RequiredScope(context.ApiDescription.HttpMethod ?? "", context.ApiDescription.ActionDescriptor.AttributeRouteInfo?.Template);
        if (scope is not null)
        {
            if (context.ApiDescription.ActionDescriptor.AttributeRouteInfo?.Template == "api/reports/processes/export/{format}")
                operation.Responses["200"] = new OpenApiResponse
                {
                    Description = "Download do relatório em pdf, xlsx ou csv.",
                    Content = new Dictionary<string, OpenApiMediaType>
                    {
                        ["application/pdf"] = Binary(), ["text/csv"] = Binary(),
                        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = Binary()
                    }
                };
            foreach (var (code, description) in new[] {
                ("400", "Dados ou filtros inválidos."), ("401", "Token ausente, inválido, expirado ou revogado."),
                ("403", "Escopo ausente ou proprietário sem permissão para o recurso."),
                ("404", "Recurso não encontrado."), ("429", "Limite de 120 chamadas por minuto por token nesta instância.") })
                operation.Responses.TryAdd(code, new OpenApiResponse { Description = description });
            if (scope.StartsWith("automations:"))
                operation.Responses.TryAdd("409", new OpenApiResponse { Description = "Execução encerrada, prazo excedido, automação pausada ou externalId em conflito." });
            operation.Description = (operation.Description ?? "") + $" Integrações: escopo `{scope}` e permissões atuais do proprietário obrigatórios.";
            operation.Security = new List<OpenApiSecurityRequirement>
            {
                Requirement("Bearer"), Requirement("IntegrationToken")
            };
        }
    }

    private static OpenApiMediaType Binary() => new() { Schema = new OpenApiSchema { Type = "string", Format = "binary" } };

    private static OpenApiSecurityRequirement Requirement(string id) => new()
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = id } }] = Array.Empty<string>()
    };
}
