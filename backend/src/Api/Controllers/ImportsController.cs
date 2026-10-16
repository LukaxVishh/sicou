using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Infrastructure.Services;

namespace Sicou.Api.Controllers;

[ApiController, Authorize, Route("api/imports")]
public class ImportsController(DataImportService imports) : ControllerBase
{
    [HttpGet("options")]
    public async Task<IActionResult> Options() { Response.Headers.CacheControl = "no-store"; return Ok(await imports.OptionsAsync()); }

    [HttpGet("{kind}/template/{format}")]
    public async Task<IActionResult> Template(string kind, string format)
    {
        if (!(await imports.OptionsAsync()).Kinds.Contains(kind)) return Forbid();
        var file = ImportFileReader.Template(kind, format);
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpPost("{kind}/preview"), RequestSizeLimit(ImportFileReader.MaxBytes + 65536)]
    public async Task<IActionResult> Preview(string kind, [FromForm] Guid companyId, [FromForm] Guid? areaId, IFormFile file)
    {
        if (file.Length is 0 or > ImportFileReader.MaxBytes) return BadRequest(new { message = "Envie um arquivo de até 2 MB." });
        using var buffer = new MemoryStream(); await file.CopyToAsync(buffer, HttpContext.RequestAborted);
        Response.Headers.CacheControl = "no-store";
        return Ok(await imports.PreviewAsync(kind, companyId, areaId, file.FileName, buffer.ToArray()));
    }

    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm(ConfirmImportRequest request, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await imports.ConfirmAsync(request.Token, ct));
    }
}
