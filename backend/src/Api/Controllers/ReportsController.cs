using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;

namespace Sicou.Api.Controllers;

[ApiController, Authorize, Route("api/reports")]
public class ReportsController(IReportService reports) : ControllerBase
{
    [HttpGet("options")]
    public async Task<IActionResult> Options(CancellationToken ct) => Ok(await reports.GetOptionsAsync(ct));

    [HttpGet("processes")]
    public async Task<IActionResult> Processes([FromQuery] ReportFilter filter, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await reports.GetAsync(filter, ct));
    }

    [HttpGet("processes/export/{format}")]
    public async Task<IActionResult> Export(string format, [FromQuery] ReportFilter filter, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var file = await reports.ExportAsync(filter, format.ToLowerInvariant(), ct);
        return File(file.Content, file.ContentType, file.FileName);
    }

    [HttpPut("processes/{id:guid}/responsible")]
    public async Task<IActionResult> Assign(Guid id, AssignResponsibleRequest request, CancellationToken ct)
    {
        await reports.AssignAsync(id, request.UserId, ct);
        return NoContent();
    }

    [HttpGet("processes/{id:guid}/responsible-options")]
    public async Task<IActionResult> AssignmentOptions(Guid id, CancellationToken ct) => Ok(await reports.GetAssignmentOptionsAsync(id, ct));

    [HttpGet("catalog/options")]
    public async Task<IActionResult> CatalogOptions(CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await reports.GetCatalogOptionsAsync(ct));
    }

    [HttpGet("catalog/{kind}")]
    public async Task<IActionResult> Catalog(string kind, [FromQuery] CatalogReportFilter filter, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await reports.GetCatalogAsync(kind, filter, false, ct));
    }

    [HttpGet("catalog/{kind}/export/{format}")]
    public async Task<IActionResult> ExportCatalog(string kind, string format, [FromQuery] CatalogReportFilter filter, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        var file = await reports.ExportCatalogAsync(kind, filter, format.ToLowerInvariant(), ct);
        return File(file.Content, file.ContentType, file.FileName);
    }
}
