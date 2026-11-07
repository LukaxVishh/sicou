namespace Sicou.Api.Integrations;

// Exact method + ASP.NET route template. New application routes are denied by default.
public static class IntegrationRoutes
{
    public static readonly IReadOnlyDictionary<string, string> Allowed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["POST api/posts"] = "posts:create",
        ["POST api/documents/process"] = "documents:process",
        ["GET api/imports/options"] = "imports:read",
        ["GET api/imports/{kind}/template/{format}"] = "imports:read",
        ["POST api/imports/{kind}/preview"] = "imports:write",
        ["POST api/imports/confirm"] = "imports:write",
        ["GET api/automations"] = "automations:read",
        ["GET api/automations/{id:guid}/runs"] = "automations:read",
        ["POST api/automations/{id:guid}/runs"] = "automations:write",
        ["POST api/automations/runs/{id:guid}/heartbeat"] = "automations:write",
        ["POST api/automations/runs/{id:guid}/complete"] = "automations:write",
        ["POST api/processes"] = "processes:create",
        ["PUT api/processes/{id:guid}/draft"] = "processes:write",
        ["POST api/processes/{id:guid}/protocol"] = "processes:write",
        ["POST api/processes/{id:guid}/advance"] = "processes:write",
        ["POST api/processes/{id:guid}/cancel"] = "processes:cancel",
        ["POST api/processes/{id:guid}/transfer"] = "processes:transfer",
        ["GET api/processes/my"] = "processes:read",
        ["GET api/processes/search"] = "processes:read",
        ["GET api/processes/{id:guid}"] = "processes:read",
        ["GET api/areas/{areaId:guid}/processes"] = "processes:read",
        ["GET api/process-types/available"] = "processes:read",
        ["GET api/process-types/{id:guid}"] = "processes:read",
        ["GET api/users/me/process-nodes"] = "processes:read",
        ["GET api/reports/options"] = "reports:read",
        ["GET api/reports/processes"] = "reports:read",
        ["GET api/reports/processes/export/{format}"] = "reports:read",
    };

    public static string[] Scopes => Allowed.Values.Distinct().Order().ToArray();
    public static string? RequiredScope(string method, string? route) =>
        Allowed.GetValueOrDefault($"{method} {route?.Trim('/')}");
}
