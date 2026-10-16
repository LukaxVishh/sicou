using Sicou.Application.Interfaces.Services;

namespace Sicou.Infrastructure.Services;

public record ImportOptions(IReadOnlyList<string> Kinds, IReadOnlyList<ReportOption> Companies,
    IReadOnlyList<ReportOption> WorkflowAreas, IReadOnlyList<ReportOption> GuideAreas);
public record ImportLine(int Number, Dictionary<string, string> Values, List<string> Errors, List<string> Warnings);
public record ImportPreview(string? Token, DateTime? ExpiresAt, int Total, int Valid, IReadOnlyList<ImportLine> Rows);
public record ImportCredential(string Email, string TemporaryPassword, DateTime ExpiresAt);
public record ImportResult(string Kind, int Created, IReadOnlyList<ImportCredential> Credentials);
public record ConfirmImportRequest(string Token);

public class WorkflowImportFile { public List<WorkflowImport> Workflows { get; set; } = []; }
public class WorkflowImport
{
    public string Codigo { get; set; } = "";
    public string Nome { get; set; } = "";
    public string Descricao { get; set; } = "";
    public string Publico { get; set; } = "Todos";
    public List<ImportStage> Etapas { get; set; } = [];
    public List<ImportField> Campos { get; set; } = [];
    public List<ImportTransition> Transicoes { get; set; } = [];
}
public class ImportStage
{
    public string Codigo { get; set; } = "";
    public string Nome { get; set; } = "";
    public string Tipo { get; set; } = "etapa";
}
public class ImportField
{
    public string Codigo { get; set; } = "";
    public string Nome { get; set; } = "";
    public string Tipo { get; set; } = "Text";
    public string Etapa { get; set; } = "";
    public bool Obrigatorio { get; set; }
    public List<string> Opcoes { get; set; } = [];
}
public class ImportTransition
{
    public string Origem { get; set; } = "";
    public string Destino { get; set; } = "";
    public bool PermiteRetorno { get; set; }
}
