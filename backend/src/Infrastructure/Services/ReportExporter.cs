using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using Sicou.Application.Interfaces.Services;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Writer;

namespace Sicou.Infrastructure.Services;

public static class ReportExporter
{
    private record Column(string Key, string Label, Func<ReportRow, object?> Value);
    private static readonly Column[] Columns = [
        new("number", "Número", r => r.Number), new("title", "Título", r => r.Title),
        new("company", "Empresa", r => r.Company), new("area", "Setor", r => r.Area),
        new("unit", "Unidade", r => r.Unit), new("processType", "Tipo de processo", r => r.ProcessType),
        new("status", "Status", r => r.Status), new("responsible", "Responsável", r => r.Responsible),
        new("createdBy", "Solicitante", r => r.CreatedBy), new("createdAt", "Criado em (UTC)", r => r.CreatedAt),
        new("updatedAt", "Atualizado em (UTC)", r => r.UpdatedAt) ];

    public static ReportFile Export(IReadOnlyList<ReportRow> rows, ReportFilter filter, string format)
    {
        var keys = string.IsNullOrWhiteSpace(filter.Columns)
            ? new[] { "number", "title", "area", "unit", "status", "responsible", "createdAt" }
            : filter.Columns.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Distinct().ToArray();
        if (keys.Length == 0 || keys.Any(k => !Columns.Any(c => c.Key == k))) throw new ArgumentException("Colunas de relatório inválidas.");
        // Canonical order matches the on-screen table regardless of checkbox click order.
        var columns = Columns.Where(c => keys.Contains(c.Key)).ToArray();
        return ExportData(rows.Select(row => new CatalogReportRow(row.Id, columns.ToDictionary(c => c.Key, c => c.Value(row)))).ToList(),
            columns.Select(c => new ReportColumn(c.Key, c.Label)).ToArray(), filter.Columns, format, "processos", "Relatório de processos", filter.StartDate, filter.EndDate);
    }

    public static ReportFile ExportData(IReadOnlyList<CatalogReportRow> rows, ReportColumn[] available, string? selected,
        string format, string key, string title, DateOnly? start, DateOnly? end)
    {
        if (rows.Count > 5000) throw new ArgumentException("A exportação permite até 5.000 registros. Refine os filtros.");
        var keys = string.IsNullOrWhiteSpace(selected) ? available.Select(c => c.Key).ToArray()
            : selected.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Distinct().ToArray();
        if (keys.Length == 0 || keys.Any(k => !available.Any(c => c.Key == k))) throw new ArgumentException("Colunas de relatório inválidas.");
        var columns = available.Where(c => keys.Contains(c.Key)).ToArray();
        var values = rows.Select(r => columns.Select(c => r.Values.GetValueOrDefault(c.Key)).ToArray()).ToArray();
        var filter = new ReportFilter { StartDate = start, EndDate = end };
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
        return format switch {
            "csv" => new(Csv(values, columns), "text/csv; charset=utf-8", $"{key}-{stamp}.csv"),
            "xlsx" => new(Excel(values, columns), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{key}-{stamp}.xlsx"),
            "pdf" => new(Pdf(values, columns, filter, title), "application/pdf", $"{key}-{stamp}.pdf"),
            _ => throw new ArgumentException("Formato não suportado.") };
    }

    private static string Text(object? value) => value is DateTime date
        ? date.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture) : value?.ToString() ?? "";

    // Spreadsheets may execute formulas even when CSV fields are quoted.
    private static string SafeCsv(string text) => text.TrimStart() is var trimmed && trimmed.Length > 0
        && ("=+-@".Contains(trimmed[0]) || text[0] is '\t' or '\r' or '\n') ? "'" + text : text;

    private static byte[] Csv(IReadOnlyList<object?[]> rows, ReportColumn[] columns)
    {
        using var output = new MemoryStream();
        using (var writer = new StreamWriter(output, new UTF8Encoding(true), leaveOpen: true))
        using (var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture) { Delimiter = ";", NewLine = "\r\n" }))
        {
            foreach (var column in columns) csv.WriteField(column.Label);
            csv.NextRecord();
            foreach (var row in rows)
            {
                foreach (var value in row) csv.WriteField(SafeCsv(Text(value)));
                csv.NextRecord();
            }
        }
        return output.ToArray();
    }

    private static byte[] Excel(IReadOnlyList<object?[]> rows, ReportColumn[] columns)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Relatório");
        for (var c = 0; c < columns.Length; c++) sheet.Cell(1, c + 1).Value = columns[c].Label;
        for (var r = 0; r < rows.Count; r++)
            for (var c = 0; c < columns.Length; c++)
            {
                var cell = sheet.Cell(r + 2, c + 1);
                var value = rows[r][c];
                if (value is DateTime date) { cell.Value = DateTime.SpecifyKind(date, DateTimeKind.Unspecified); cell.Style.DateFormat.Format = "dd/mm/yyyy hh:mm"; }
                else if (value is int number) cell.Value = number;
                else if (value is long count) cell.Value = count;
                else cell.Value = Text(value); // Text is never assigned to FormulaA1.
            }
        var header = sheet.Range(1, 1, 1, columns.Length);
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#4338CA");
        header.Style.Font.FontColor = XLColor.White;
        header.Style.Font.Bold = true;
        sheet.SheetView.FreezeRows(1);
        sheet.Range(1, 1, rows.Count + 1, columns.Length).SetAutoFilter();
        sheet.Columns().AdjustToContents(8, 45);
        sheet.Rows().Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return output.ToArray();
    }

    private static byte[] Pdf(IReadOnlyList<object?[]> rows, ReportColumn[] columns, ReportFilter filter, string title)
    {
        if (rows.Count > 1000) throw new ArgumentException("Para PDF, refine os filtros para até 1.000 registros. XLSX e CSV permitem 5.000.");
        using var builder = new PdfDocumentBuilder();
        using var resource = typeof(ReportExporter).Assembly.GetManifestResourceStream("Sicou.Infrastructure.Assets.NotoSans-Regular.ttf")!;
        using var fontBytes = new MemoryStream();
        resource.CopyTo(fontBytes);
        var font = builder.AddTrueTypeFont(fontBytes.ToArray());
        const double pageWidth = 842, pageHeight = 595, margin = 30, fontSize = 8;
        var weights = columns.Select(c => c.Key switch {
            "summary" => 3.0, "email" or "url" or "title" => 2.0,
            "company" or "name" or "roles" or "createdAt" or "updatedAt" => 1.6,
            "state" => 0.6, _ => 1.0 }).ToArray();
        var widths = weights.Select(w => (pageWidth - 2 * margin) * w / weights.Sum()).ToArray();
        var positions = Enumerable.Range(0, columns.Length).Select(i => margin + widths.Take(i).Sum()).ToArray();
        var pageNo = 0;
        PdfPageBuilder page = null!;
        var pages = new List<PdfPageBuilder>();
        var replacements = new Dictionary<int, string>();
        var unsupported = false;
        double y = 0;
        // Measure the embedded font and prefer word boundaries, splitting only oversized tokens.
        List<string> Wrap(string text, double cellWidth, double size)
        {
            var clean = new StringBuilder();
            foreach (var rune in text.EnumerateRunes())
            {
                if (Rune.IsWhiteSpace(rune) || Rune.IsControl(rune)) { clean.Append(' '); continue; }
                if (!replacements.TryGetValue(rune.Value, out var replacement))
                {
                    replacement = rune.ToString();
                    try {
                        if (rune.Value > char.MaxValue) throw new InvalidOperationException();
                        page.MeasureText(replacement, size, new PdfPoint(0, 0), font);
                    }
                    catch (InvalidOperationException) { replacement = "?"; unsupported = true; }
                    replacements[rune.Value] = replacement;
                }
                clean.Append(replacement);
            }
            text = clean.ToString();
            var result = new List<string>();
            bool Fits(string value)
            {
                var letters = page.MeasureText(value, size, new PdfPoint(0, 0), font);
                return letters.Count == 0 || letters.Max(l => l.GlyphRectangle.Right) - letters.Min(l => l.GlyphRectangle.Left) <= cellWidth - 10;
            }
            var line = "";
            foreach (var word in text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
            {
                var candidate = line.Length == 0 ? word : line + " " + word;
                if (Fits(candidate)) { line = candidate; continue; }
                if (line.Length > 0) { result.Add(line); line = ""; }
                foreach (var rune in word.EnumerateRunes())
                {
                    if (line.Length > 0 && !Fits(line + rune)) { result.Add(line); line = ""; }
                    line += rune.ToString();
                }
            }
            if (line.Length > 0) result.Add(line);
            if (result.Count == 0) result.Add("");
            return result;
        }
        void NewPage()
        {
            page = builder.AddPage(pageWidth, pageHeight); pageNo++;
            pages.Add(page);
            page.SetTextAndFillColor(30, 41, 59);
            page.AddText("SICOU  /  " + title, 16, new PdfPoint(margin, 560), font);
            page.SetTextAndFillColor(100, 116, 139);
            page.AddText($"{rows.Count} registros | Criação: {filter.StartDate?.ToString("dd/MM/yyyy") ?? "sem início definido"} a {filter.EndDate?.ToString("dd/MM/yyyy") ?? "sem limite final"} (UTC)", 9, new PdfPoint(margin, 542), font);
            page.AddText($"Gerado em {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC  |  Página {pageNo}", 8, new PdfPoint(margin, 18), font);
            var headers = columns.Select((c, i) => Wrap(c.Label, widths[i], fontSize)).ToArray();
            var headerHeight = Math.Max(36, 10 + headers.Max(lines => lines.Count) * 10);
            var headerBottom = 524 - headerHeight;
            page.SetTextAndFillColor(67, 56, 202);
            page.DrawRectangle(new PdfPoint(margin - 5, headerBottom), pageWidth - margin * 2 + 10, headerHeight, 0, true);
            page.SetTextAndFillColor(255, 255, 255);
            y = 510;
            for (var c = 0; c < columns.Length; c++)
            {
                var lines = headers[c];
                for (var i = 0; i < lines.Count; i++) page.AddText(lines[i], fontSize, new PdfPoint(positions[c], y - i * 10), font);
            }
            page.SetTextAndFillColor(51, 65, 85);
            y = headerBottom - 15;
        }
        NewPage();
        if (rows.Count == 0) page.AddText("Nenhum registro encontrado para os filtros selecionados.", 11, new PdfPoint(margin, y), font);
        var rowIndex = 0;
        foreach (var row in rows)
        {
            var cells = row.Select((value, index) => Wrap(Text(value), widths[index], fontSize)).ToArray();
            var maxLines = cells.Max(c => c.Count);
            var height = maxLines * 11 + 14;
            if (height < 425 && y - height < 45) NewPage();
            if (rowIndex++ % 2 == 0)
            {
                page.SetTextAndFillColor(248, 250, 252);
                page.DrawRectangle(new PdfPoint(margin - 5, Math.Max(35, y - height + 8)), pageWidth - margin * 2 + 10, Math.Min(height, y - 27), 0, true);
                page.SetTextAndFillColor(51, 65, 85);
            }
            for (var line = 0; line < maxLines; line++)
            {
                if (y < 45) NewPage();
                for (var c = 0; c < cells.Length; c++)
                    if (line < cells[c].Count) page.AddText(cells[c][line], fontSize, new PdfPoint(positions[c], y), font);
                y -= 11;
            }
            y -= 14;
        }
        if (unsupported)
            foreach (var outputPage in pages)
                outputPage.AddText("Caracteres não disponíveis na fonte foram substituídos por ?.", 7, new PdfPoint(margin, 7), font);
        return builder.Build();
    }
}
