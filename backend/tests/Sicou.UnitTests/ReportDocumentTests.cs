using System.IO.Compression;
using System.Text;
using ClosedXML.Excel;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Sicou.Application.Interfaces.Services;
using Sicou.Infrastructure.Services;

namespace Sicou.UnitTests;

public class ReportDocumentTests
{
    private static ReportRow Row(string title = "Solicitação de férias") => new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null,
        "2026-001", title, "Empresa Ágil", "Operações", "Sede", "Férias", "Em análise", null,
        "Sem responsável", "João", new DateTime(2026, 10, 15, 12, 30, 0, DateTimeKind.Utc), null, true);
    private static ProcessedDocument Process(byte[] bytes, string name) => new DocumentProcessingService().Process(bytes, name, default);

    [Fact]
    public void CsvQuotesMultilineAndNeutralizesFormulaIncludingLeadingSpaces()
    {
        var file = ReportExporter.Export([Row(" \t=HYPERLINK(\"https://example.test\");\nperigo")], new() { Columns = "number,title" }, "csv");
        var text = Encoding.UTF8.GetString(file.Content);
        Assert.StartsWith("\uFEFFNúmero;Título", text);
        var parsed = Process(file.Content, "relatorio.csv");
        Assert.Equal(2, parsed.Tables[0].Rows.Count);
        Assert.StartsWith("' \t=HYPERLINK", parsed.Tables[0].Rows[1][1]);
        Assert.Contains("\nperigo", parsed.Tables[0].Rows[1][1]);
    }

    [Fact]
    public void XlsxKeepsDatesTypedAndFormulaLikeValuesAsText()
    {
        var file = ReportExporter.Export([Row("=1+1")], new() { Columns = "title,createdAt" }, "xlsx");
        using var stream = new MemoryStream(file.Content);
        using var workbook = new XLWorkbook(stream);
        var sheet = workbook.Worksheet(1);
        Assert.Equal("=1+1", sheet.Cell(2, 1).GetString());
        Assert.False(sheet.Cell(2, 1).HasFormula);
        Assert.Equal(XLDataType.DateTime, sheet.Cell(2, 2).DataType);
        Assert.Equal(2, Process(file.Content, "dados.xlsx").Tables[0].Rows.Count);
    }

    [Fact]
    public void PdfPreservesAccentsAndPaginatesLongTitles()
    {
        var rows = Enumerable.Range(0, 40).Select(_ => Row(new string('á', 200))).ToArray();
        var file = ReportExporter.Export(rows, new(), "pdf");
        var parsed = Process(file.Content, "relatorio.pdf");
        Assert.True(parsed.PageCount > 1);
        Assert.Contains("Relatório de processos", parsed.Text);
        Assert.Contains("Operações", parsed.Text);
        Assert.Contains("áááá", parsed.Text);
    }

    [Fact]
    public void EmptyPdfIsValidAndExplainsNoResults()
    {
        var file = ReportExporter.Export([], new(), "pdf");
        var parsed = Process(file.Content, "vazio.pdf");
        Assert.Equal(1, parsed.PageCount);
        Assert.Contains("Nenhum registro", parsed.Text);
    }

    [Fact]
    public void DocxExtractsParagraphsAndTableCells()
    {
        using var stream = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(stream, DocumentFormat.OpenXml.WordprocessingDocumentType.Document, true))
        {
            var main = doc.AddMainDocumentPart();
            main.Document = new Document(new Body(new Paragraph(new Run(new Text("Orientação à equipe"))),
                new Table(new TableRow(new TableCell(new Paragraph(new Run(new Text("Área")))), new TableCell(new Paragraph(new Run(new Text("RH"))))))));
        }
        var parsed = Process(stream.ToArray(), "guia.docx");
        Assert.Contains("Orientação à equipe", parsed.Text);
        Assert.Equal("RH", parsed.Tables[0].Rows[0][1]);
    }

    [Fact]
    public void SpreadsheetRetainsEmptyColumns()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Setor");
        sheet.Cell("A1").Value = "Nome"; sheet.Cell("C1").Value = "Unidade";
        using var output = new MemoryStream(); workbook.SaveAs(output);
        var parsed = Process(output.ToArray(), "esparsa.xlsx");
        Assert.Equal(new[] { "Nome", "", "Unidade" }, parsed.Tables[0].Rows[0]);
    }

    [Theory]
    [InlineData("exe")]
    [InlineData("docx")]
    [InlineData("pdf")]
    [InlineData("xlsx")]
    public void RejectsUnsupportedOrMismatchedContent(string extension) => Assert.Throws<ArgumentException>(() => Process(Encoding.UTF8.GetBytes("arquivo inválido"), "arquivo." + extension));

    [Fact]
    public void RejectsOversizedArchiveBeforeOpeningOfficeDocument()
    {
        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
        using (var entry = zip.CreateEntry("large.xml").Open()) entry.Write(new byte[41 * 1024 * 1024]);
        Assert.Throws<ArgumentException>(() => Process(stream.ToArray(), "bomba.xlsx"));
    }

    [Fact]
    public void RejectsInvalidExportColumnsAndExcessivePdfRows()
    {
        Assert.Throws<ArgumentException>(() => ReportExporter.Export([], new() { Columns = "password" }, "csv"));
        Assert.Throws<ArgumentException>(() => ReportExporter.Export(Enumerable.Repeat(Row(), 1001).ToArray(), new(), "pdf"));
    }

    [Fact]
    public void CsvPreviewStopsAtRowLimit()
    {
        var parsed = Process(Encoding.UTF8.GetBytes(string.Join("\n", Enumerable.Repeat("a;b;c", 550))), "limite.csv");
        Assert.Equal(500, parsed.Tables[0].Rows.Count);
        Assert.NotEmpty(parsed.Warnings);
    }

    [Fact]
    public void GenericExportsPreserveNumericValuesAndCustomHeader()
    {
        CatalogReportRow[] rows = [new(Guid.NewGuid(), new Dictionary<string, object?> { ["name"] = "Unidade São João", ["users"] = 12 })];
        ReportColumn[] columns = [new("name", "Unidade"), new("users", "Usuários", "number")];
        var file = ReportExporter.ExportData(rows, columns, "users,name", "xlsx", "units", "Relatório de unidades", null, null);
        using var stream = new MemoryStream(file.Content);
        using var workbook = new XLWorkbook(stream);
        Assert.Equal("Unidade", workbook.Worksheet(1).Cell(1, 1).GetString());
        Assert.Equal(12, workbook.Worksheet(1).Cell(2, 2).GetValue<int>());
        Assert.Equal(XLDataType.Number, workbook.Worksheet(1).Cell(2, 2).DataType);
    }

    [Fact]
    public void PdfUnsupportedCharactersDoNotAbortExport()
    {
        var file = ReportExporter.Export([Row("Solicitação 🚚 中文")], new(), "pdf");
        var document = Process(file.Content, "relatorio.pdf");
        Assert.Contains("Solicitação", document.Text);
        Assert.Contains("substituídos", document.Text);
    }
}
