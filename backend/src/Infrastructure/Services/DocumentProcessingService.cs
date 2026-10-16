using System.Globalization;
using System.IO.Compression;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace Sicou.Infrastructure.Services;

public record DocumentTable(string Name, IReadOnlyList<IReadOnlyList<string>> Rows);
public record ProcessedDocument(string FileName, string Format, string Text,
    IReadOnlyList<DocumentTable> Tables, IReadOnlyList<string> Warnings, int? PageCount);

/// <summary>Bounded, read-only document extraction. Does not execute macros, formulas or external links.</summary>
public class DocumentProcessingService
{
    public const int MaxBytes = 10 * 1024 * 1024;
    private const int MaxText = 100_000, MaxRows = 500, MaxColumns = 100;

    public ProcessedDocument Process(byte[] bytes, string fileName, CancellationToken ct)
    {
        if (bytes.Length is 0 or > MaxBytes) throw new ArgumentException("Envie um arquivo de até 10 MB.");
        fileName = Path.GetFileName(fileName.Replace('\\', '/'));
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (extension is not (".docx" or ".xlsx" or ".csv" or ".pdf")) throw new ArgumentException("Formatos aceitos: DOCX, XLSX, CSV e PDF.");
        var warnings = new List<string>();
        var text = new StringBuilder();
        var tables = new List<DocumentTable>();
        var tableBudget = 500_000;
        string CellText(string value)
        {
            var clipped = Clip(value);
            if (clipped.Length > tableBudget) clipped = clipped[..tableBudget];
            tableBudget -= clipped.Length;
            return clipped;
        }
        int? pages = null;
        void Append(string value)
        {
            if (text.Length >= MaxText) return;
            text.AppendLine(value.Length > MaxText - text.Length ? value[..(MaxText - text.Length)] : value);
        }
        using var input = new MemoryStream(bytes, false);
        if (extension is ".docx" or ".xlsx") ValidateArchive(input);
        try
        {
            switch (extension)
            {
                case ".docx":
                    using (var doc = WordprocessingDocument.Open(input, false))
                    {
                        var body = doc.MainDocumentPart?.Document?.Body ?? throw new ArgumentException("DOCX sem corpo de documento.");
                        foreach (var paragraph in body.Descendants<DocumentFormat.OpenXml.Wordprocessing.Paragraph>())
                        {
                            ct.ThrowIfCancellationRequested();
                            Append(paragraph.InnerText);
                            if (text.Length >= MaxText) break;
                        }
                        foreach (var table in body.Elements<DocumentFormat.OpenXml.Wordprocessing.Table>().Take(20))
                        {
                            if (table == null) continue;
                            var rows = table.Elements<DocumentFormat.OpenXml.Wordprocessing.TableRow>().Take(MaxRows)
                                .Select(r => (IReadOnlyList<string>)r.Elements<DocumentFormat.OpenXml.Wordprocessing.TableCell>()
                                    .Take(MaxColumns).Select(c => CellText(c.InnerText)).ToArray()).ToArray();
                            tables.Add(new($"Tabela {tables.Count + 1}", rows));
                        }
                        if (tables.Count > 0) warnings.Add("Prévia limitada a 20 tabelas, 500 linhas e 100 colunas por tabela.");
                    }
                    break;
                case ".xlsx":
                    using (var workbook = SpreadsheetDocument.Open(input, false))
                    {
                        var part = workbook.WorkbookPart ?? throw new ArgumentException("XLSX sem pasta de trabalho.");
                        var shared = part.SharedStringTablePart?.SharedStringTable?.Elements<SharedStringItem>().Select(s => Clip(s.InnerText)).ToArray() ?? [];
                        var sheets = part.Workbook?.Sheets ?? throw new ArgumentException("XLSX sem planilhas.");
                        foreach (var sheet in sheets.Elements<Sheet>().Take(20))
                        {
                            ct.ThrowIfCancellationRequested();
                            if (sheet == null) continue;
                            var sheetPart = (WorksheetPart)part.GetPartById(sheet.Id!.Value!);
                            var rows = new List<IReadOnlyList<string>>();
                            using var reader = OpenXmlReader.Create(sheetPart);
                            while (reader.Read())
                            {
                                ct.ThrowIfCancellationRequested();
                                if (reader.ElementType != typeof(Row) || !reader.IsStartElement) continue;
                                if (rows.Count >= MaxRows) break;
                                var row = reader.LoadCurrentElement() as Row;
                                if (row == null) continue;
                                var values = new SortedDictionary<int, string>();
                                foreach (var cell in row.Elements<Cell>())
                                {
                                    var index = ColumnIndex(cell.CellReference?.Value);
                                    if (index < 0 || index >= MaxColumns) continue;
                                    var value = cell.CellValue?.Text ?? cell.InlineString?.InnerText ?? "";
                                    if (cell.DataType?.Value == CellValues.SharedString && int.TryParse(value, out var n) && n >= 0 && n < shared.Length) value = shared[n];
                                    values[index] = CellText(value);
                                }
                                if (values.Count == 0) continue;
                                var cells = Enumerable.Range(0, values.Keys.Max() + 1).Select(i => values.GetValueOrDefault(i, "")).ToArray();
                                rows.Add(cells); Append(string.Join(" | ", cells));
                            }
                            tables.Add(new(sheet.Name?.Value ?? "Planilha", rows));
                        }
                        warnings.Add("Prévia limitada a 20 planilhas, 500 linhas e 100 colunas. Fórmulas não são executadas; datas podem aparecer como números seriais e fórmulas como valores em cache.");
                    }
                    break;
                case ".csv":
                    using (var stream = new StreamReader(input, new UTF8Encoding(false, true), detectEncodingFromByteOrderMarks: true))
                    using (var csv = new CsvReader(stream, new CsvConfiguration(CultureInfo.InvariantCulture) {
                        DetectDelimiter = true, DetectDelimiterValues = [",", ";", "\t"], HasHeaderRecord = false,
                        MaxFieldSize = 100_000, ExceptionMessagesContainRawData = false }))
                    {
                        var rows = new List<IReadOnlyList<string>>();
                        while (rows.Count < MaxRows && csv.Read())
                        {
                            ct.ThrowIfCancellationRequested();
                            var cells = (csv.Parser.Record ?? []).Take(MaxColumns).Select(CellText).ToArray();
                            rows.Add(cells); Append(string.Join(" | ", cells));
                        }
                        tables.Add(new("Dados CSV", rows));
                        warnings.Add("CSV deve usar UTF-8 (ou BOM UTF-16), com separador vírgula, ponto e vírgula ou tabulação. Prévia de até 500 linhas e 100 colunas.");
                    }
                    break;
                case ".pdf":
                    if (!Encoding.ASCII.GetString(bytes, 0, Math.Min(bytes.Length, 1024)).Contains("%PDF-")) throw new ArgumentException("Conteúdo PDF inválido.");
                    using (var pdf = PdfDocument.Open(bytes))
                    {
                        pages = pdf.NumberOfPages;
                        for (var i = 1; i <= Math.Min(pages.Value, 100); i++)
                        {
                            ct.ThrowIfCancellationRequested();
                            Append(ContentOrderTextExtractor.GetText(pdf.GetPage(i)));
                            if (text.Length >= MaxText) break;
                        }
                        if (pages > 100) warnings.Add("Extraídas no máximo 100 páginas.");
                        if (text.ToString().Trim().Length == 0) warnings.Add("PDF sem texto extraível. PDFs digitalizados precisam de OCR, não incluído nesta integração.");
                    }
                    break;
            }
        }
        catch (OperationCanceledException) { throw; }
        catch (ArgumentException) { throw; }
        catch { throw new ArgumentException("Não foi possível ler o arquivo. Verifique o formato, a codificação e se está íntegro e sem senha."); }
        if (text.Length >= MaxText) warnings.Add("Texto limitado aos primeiros 100.000 caracteres.");
        if (tables.Count > 0) warnings.Add("Células da prévia são limitadas a 2.000 caracteres.");
        if (tableBudget == 0) warnings.Add("Conteúdo das tabelas limitado a 500.000 caracteres no total; células limitadas a 2.000 caracteres.");
        return new(fileName, extension.TrimStart('.').ToUpperInvariant(), text.ToString()[..Math.Min(text.Length, MaxText)], tables, warnings, pages);
    }

    private static string Clip(string value) => value.Length > 2000 ? value[..2000] : value;
    private static int ColumnIndex(string? reference)
    {
        if (string.IsNullOrEmpty(reference)) return -1;
        var number = 0;
        foreach (var ch in reference.TakeWhile(char.IsLetter))
        {
            number = number * 26 + char.ToUpperInvariant(ch) - 'A' + 1;
            if (number > MaxColumns) return MaxColumns;
        }
        return number - 1;
    }
    private static void ValidateArchive(Stream input)
    {
        try
        {
            using var archive = new ZipArchive(input, ZipArchiveMode.Read, true);
            if (archive.Entries.Count > 2000)
                throw new ArgumentException("Documento excede os limites de conteúdo descompactado (40 MB / 2.000 entradas).");
            long remaining = 40L * 1024 * 1024;
            foreach (var entry in archive.Entries)
            {
                if (entry.Length > remaining) throw new ArgumentException("Documento excede o limite de 40 MB descompactados.");
                remaining -= entry.Length;
            }
            if (archive.Entries.Any(e => e.FullName.EndsWith("vbaProject.bin", StringComparison.OrdinalIgnoreCase)))
                throw new ArgumentException("Documentos com macros não são aceitos.");
        }
        catch (InvalidDataException) { throw new ArgumentException("Arquivo Office inválido ou corrompido."); }
        finally { input.Position = 0; }
    }
}
