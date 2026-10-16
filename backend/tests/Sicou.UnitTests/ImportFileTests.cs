using System.Text;
using ClosedXML.Excel;
using Sicou.Infrastructure.Services;

namespace Sicou.UnitTests;

public class ImportFileTests
{
    private static byte[] Csv(string value) => Encoding.UTF8.GetBytes(value);

    [Fact]
    public void CsvPreservesQuotedMultilineContentWithoutPreviewTruncation()
    {
        var content = new string('a', 12000) + "\nsegunda linha";
        var parsed = ImportFileReader.Read("guides", "guias.csv", Csv($"titulo;categoria;conteudo;url;publicar\nGuia;Geral;\"{content}\";;nao"));
        Assert.Equal(content, parsed.Rows.Single()["conteudo"]);
    }

    [Theory]
    [InlineData("nome;email;perfil;senha\nTeste;a@example.test;SUPER_ADMIN;senha")]
    [InlineData("nome;email;perfil;perfil\nTeste;a@example.test;UNIT_USER;UNIT_USER")]
    [InlineData("nome;email;perfil;unidade_codigo\nTeste;a@example.test;UNIT_USER;ABC;extra")]
    public void CsvRejectsUnexpectedDuplicateOrMisalignedColumns(string csv) =>
        Assert.Throws<ArgumentException>(() => ImportFileReader.Read("users", "usuarios.csv", Csv(csv)));

    [Fact]
    public void CsvRejectsOversizedBatchInsteadOfTruncating()
    {
        var csv = "nome;codigo;cidade;uf\n" + string.Join('\n', Enumerable.Range(1, 201).Select(i => $"Unidade{i};U{i};;"));
        Assert.Throws<ArgumentException>(() => ImportFileReader.Read("units", "unidades.csv", Csv(csv)));
    }

    [Fact]
    public void XlsxTemplateRoundtripsAndRejectsFormulas()
    {
        var template = ImportFileReader.Template("units", "xlsx");
        using var workbook = new XLWorkbook(new MemoryStream(template.Content));
        var sheet = workbook.Worksheet(1);
        sheet.Cell(2, 1).Value = "Unidade"; sheet.Cell(2, 2).Value = "001";
        using var stream = new MemoryStream(); workbook.SaveAs(stream);
        Assert.Equal("001", ImportFileReader.Read("units", "unidades.xlsx", stream.ToArray()).Rows.Single()["codigo"]);
        sheet.Cell(2, 1).FormulaA1 = "1+1";
        using var formula = new MemoryStream(); workbook.SaveAs(formula);
        Assert.Throws<ArgumentException>(() => ImportFileReader.Read("units", "unidades.xlsx", formula.ToArray()));
    }

    [Fact]
    public void WorkflowTemplateIncludesCompleteGraphAndRejectsUnknownFields()
    {
        var template = ImportFileReader.Template("workflows", "json");
        var graph = ImportFileReader.Read("workflows", "fluxo.json", template.Content).Workflows.Single();
        Assert.Equal(3, graph.Etapas.Count); Assert.Single(graph.Campos); Assert.Equal(2, graph.Transicoes.Count);
        Assert.Throws<ArgumentException>(() => ImportFileReader.Read("workflows", "fluxo.json", Csv("{\"workflows\":[],\"unknown\":true}")));
        Assert.Throws<ArgumentException>(() => ImportFileReader.Read("workflows", "fluxo.xlsx", template.Content));
    }
}
