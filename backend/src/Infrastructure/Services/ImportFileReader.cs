using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using Sicou.Application.Interfaces.Services;

namespace Sicou.Infrastructure.Services;

public static class ImportFileReader
{
    public const int MaxBytes = 2 * 1024 * 1024;
    public static readonly Dictionary<string, string[]> Headers = new() {
        ["units"] = ["nome", "codigo", "cidade", "uf"],
        ["users"] = ["nome", "email", "perfil", "unidade_codigo"],
        ["guides"] = ["titulo", "categoria", "conteudo", "url", "publicar"] };

    public static (List<Dictionary<string, string>> Rows, List<WorkflowImport> Workflows) Read(string kind, string fileName, byte[] data)
    {
        if (data.Length is 0 or > MaxBytes) throw new ArgumentException("Envie um arquivo de até 2 MB.");
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (kind == "workflows")
        {
            if (extension != ".json") throw new ArgumentException("Workflows completos usam o modelo JSON, com etapas, campos e transições.");
            try
            {
                var text = new UTF8Encoding(false, true).GetString(data).TrimStart('\uFEFF');
                var document = JsonSerializer.Deserialize<WorkflowImportFile>(text, new JsonSerializerOptions {
                    PropertyNameCaseInsensitive = true, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 16 });
                var workflows = document?.Workflows;
                if (workflows == null || workflows.Count is < 1 or > 10 || workflows.Any(w => w == null)) throw new ArgumentException("Informe de 1 a 10 workflows no modelo JSON.");
                return (workflows.Select(w => new Dictionary<string, string> { ["codigo"] = w.Codigo ?? "", ["nome"] = w.Nome ?? "", ["descricao"] = w.Descricao ?? "", ["publico"] = w.Publico ?? "",
                    ["etapas"] = string.Join(" | ", (w.Etapas ?? []).Where(s => s != null).Select(s => $"{s.Codigo}: {s.Nome} ({s.Tipo})")),
                    ["campos"] = string.Join(" | ", (w.Campos ?? []).Where(c => c != null).Select(c => $"{c.Codigo}: {c.Nome} ({c.Tipo}, etapa {c.Etapa}, obrigatório: {c.Obrigatorio}, opções: {string.Join(", ", c.Opcoes ?? [])})")),
                    ["transicoes"] = string.Join(" | ", (w.Transicoes ?? []).Where(t => t != null).Select(t => $"{t.Origem} → {t.Destino} (permite retorno: {t.PermiteRetorno})")) }).ToList(), workflows);
            }
            catch (JsonException) { throw new ArgumentException("JSON inválido. Use os campos e a estrutura do modelo de workflow."); }
            catch (DecoderFallbackException) { throw new ArgumentException("O JSON deve usar codificação UTF-8."); }
        }
        if (!Headers.TryGetValue(kind, out var allowed)) throw new ArgumentException("Tipo de importação inválido.");
        if (extension is not (".csv" or ".xlsx")) throw new ArgumentException("Este cadastro aceita apenas o modelo CSV ou XLSX.");
        var records = new List<string[]>();
        try
        {
            using var stream = new MemoryStream(data, false);
            if (extension == ".csv")
            {
                using var reader = new StreamReader(stream, new UTF8Encoding(false, true), true);
                using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { HasHeaderRecord = false,
                    DetectDelimiter = true, DetectDelimiterValues = [";", ",", "\t"], MaxFieldSize = 60000, ExceptionMessagesContainRawData = false });
                while (csv.Read())
                {
                    if (records.Count > 200) throw new ArgumentException("Importe até 200 registros por arquivo.");
                    records.Add((csv.Parser.Record ?? []).ToArray());
                }
            }
            else
            {
                using (var zip = new ZipArchive(stream, ZipArchiveMode.Read, true))
                {
                    long budget = 10 * 1024 * 1024;
                    if (zip.Entries.Count > 1000) throw new ArgumentException("Planilha excede o limite de conteúdo.");
                    foreach (var entry in zip.Entries) {
                        if (entry.Length > budget) throw new ArgumentException("Planilha excede 10 MB descompactados.");
                        budget -= entry.Length;
                        if (entry.FullName.EndsWith("vbaProject.bin", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Planilhas com macros não são aceitas.");
                    }
                }
                stream.Position = 0;
                using var workbook = new XLWorkbook(stream);
                if (workbook.Worksheets.Count != 1) throw new ArgumentException("O modelo deve ter apenas uma planilha.");
                var sheet = workbook.Worksheet(1);
                var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 0;
                var lastColumn = sheet.LastColumnUsed()?.ColumnNumber() ?? 0;
                if (lastRow > 201 || lastColumn > allowed.Length) throw new ArgumentException("Use até 200 registros e somente as colunas do modelo.");
                for (var r = 1; r <= lastRow; r++)
                {
                    var cells = new List<string>();
                    for (var c = 1; c <= lastColumn; c++) {
                        var cell = sheet.Cell(r, c);
                        if (cell.HasFormula) throw new ArgumentException("Fórmulas não são aceitas. Cole apenas os valores.");
                        cells.Add(cell.GetString());
                    }
                    records.Add(cells.ToArray());
                }
            }
        }
        catch (ArgumentException) { throw; }
        catch { throw new ArgumentException("Não foi possível ler o arquivo. Confira o formato, a codificação e o modelo."); }
        if (records.Count < 2) throw new ArgumentException("Preencha ao menos um registro abaixo do cabeçalho.");
        var headers = records[0].Select(h => h.Trim().ToLowerInvariant().TrimStart('\uFEFF')).ToArray();
        if (headers.Distinct().Count() != headers.Length || headers.Length != allowed.Length || !headers.Order().SequenceEqual(allowed.Order()))
            throw new ArgumentException("Cabeçalho inválido. Colunas esperadas: " + string.Join(", ", allowed));
        var rows = new List<Dictionary<string, string>>();
        foreach (var record in records.Skip(1))
        {
            if (record.All(string.IsNullOrWhiteSpace)) continue;
            if (record.Length != headers.Length) throw new ArgumentException("Há linhas com quantidade incorreta de colunas.");
            rows.Add(headers.Select((h, i) => (h, value: record[i].Trim())).ToDictionary(x => x.h, x => x.value));
        }
        if (rows.Count == 0) throw new ArgumentException("O arquivo não contém registros preenchidos.");
        return (rows, []);
    }

    public static ReportFile Template(string kind, string format)
    {
        if (kind == "workflows") {
            if (format != "json") throw new ArgumentException("O modelo de workflow usa JSON.");
            var example = new WorkflowImportFile { Workflows = [new() { Codigo = "FERIAS", Nome = "Solicitação de férias", Publico = "Todos",
                Etapas = [new() { Codigo = "INICIO", Nome = "Confecção", Tipo = "inicio" }, new() { Codigo = "ANALISE", Nome = "Análise", Tipo = "aprovacao" }, new() { Codigo = "FIM", Nome = "Conclusão", Tipo = "fim" }],
                Campos = [new() { Codigo = "MOTIVO", Nome = "Motivo", Tipo = "TextArea", Etapa = "INICIO", Obrigatorio = true }],
                Transicoes = [new() { Origem = "INICIO", Destino = "ANALISE" }, new() { Origem = "ANALISE", Destino = "FIM", PermiteRetorno = true }] }] };
            return new(JsonSerializer.SerializeToUtf8Bytes(example, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true }), "application/json", "modelo-workflows.json");
        }
        if (!Headers.TryGetValue(kind, out var headers)) throw new ArgumentException("Tipo de importação inválido.");
        if (format == "csv") return new(new UTF8Encoding(true).GetPreamble().Concat(Encoding.UTF8.GetBytes(string.Join(';', headers) + "\r\n")).ToArray(), "text/csv; charset=utf-8", $"modelo-{kind}.csv");
        if (format != "xlsx") throw new ArgumentException("Modelo disponível em CSV ou XLSX.");
        using var workbook = new XLWorkbook(); var sheet = workbook.AddWorksheet("Importação");
        for (var i = 0; i < headers.Length; i++) { sheet.Cell(1, i + 1).Value = headers[i]; sheet.Column(i + 1).Style.NumberFormat.Format = "@"; }
        sheet.Row(1).Style.Font.Bold = true; sheet.Columns().Width = 24; sheet.SheetView.FreezeRows(1);
        using var output = new MemoryStream(); workbook.SaveAs(output);
        return new(output.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"modelo-{kind}.xlsx");
    }
}
