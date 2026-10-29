using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Guide;
using Sicou.Infrastructure.Services;

namespace Sicou.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/areas/{areaId:guid}/guide")]
public class GuideController(IGuideService service) : ControllerBase
{
    private static readonly SemaphoreSlim PreviewCapacity = new(2);

    /// <summary>Prévia de DOCX/XLSX/CSV (texto e tabelas) com a mesma autorização do download.</summary>
    [HttpGet("items/{id:guid}/preview")]
    public async Task<IActionResult> Preview(Guid areaId, Guid id,
        [FromServices] DocumentProcessingService processor, CancellationToken ct)
    {
        var file = await service.GetFileAsync(areaId, id);
        Response.Headers["Cache-Control"] = "no-store";
        if (!await PreviewCapacity.WaitAsync(0, ct))
            return StatusCode(429, new { message = "Prévia ocupada. Tente novamente em instantes." });
        try { return Ok(processor.Process(file.Data, file.FileName, ct)); }
        finally { PreviewCapacity.Release(); }
    }

    [HttpGet("/api/guide/areas")]
    public async Task<IActionResult> Areas() => Ok(await service.GetAreasAsync());

    [HttpGet]
    public async Task<IActionResult> Get(Guid areaId) => Ok(await service.GetAsync(areaId));

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory(Guid areaId, GuideCategoryRequest request)
    {
        var result = await service.SaveCategoryAsync(areaId, null, request);
        return CreatedAtAction(nameof(Get), new { areaId }, result);
    }

    [HttpPut("categories/{id:guid}")]
    public async Task<IActionResult> UpdateCategory(Guid areaId, Guid id, GuideCategoryRequest request) =>
        Ok(await service.SaveCategoryAsync(areaId, id, request));

    [HttpDelete("categories/{id:guid}")]
    public async Task<IActionResult> DeleteCategory(Guid areaId, Guid id)
    {
        await service.DeleteCategoryAsync(areaId, id);
        return NoContent();
    }

    [HttpPost("items")]
    public async Task<IActionResult> CreateItem(Guid areaId, GuideItemRequest request)
    {
        var result = await service.SaveItemAsync(areaId, null, request);
        return CreatedAtAction(nameof(Get), new { areaId }, result);
    }

    [HttpPut("items/{id:guid}")]
    public async Task<IActionResult> UpdateItem(Guid areaId, Guid id, GuideItemRequest request) =>
        Ok(await service.SaveItemAsync(areaId, id, request));

    [HttpDelete("items/{id:guid}")]
    public async Task<IActionResult> DeleteItem(Guid areaId, Guid id)
    {
        await service.DeleteItemAsync(areaId, id);
        return NoContent();
    }

    [HttpPost("items/{id:guid}/file")]
    [RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<IActionResult> Upload(Guid areaId, Guid id, IFormFile file)
    {
        if (file.Length == 0 || file.Length > 10 * 1024 * 1024)
            return BadRequest(new { message = "O arquivo deve ter entre 1 byte e 10 MB." });
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        await service.SaveFileAsync(areaId, id, file.FileName, stream.ToArray());
        return NoContent();
    }

    [HttpGet("items/{id:guid}/file")]
    public async Task<IActionResult> Download(Guid areaId, Guid id)
    {
        var file = await service.GetFileAsync(areaId, id);
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "no-store";
        return File(file.Data, "application/octet-stream", file.FileName);
    }

    [HttpDelete("items/{id:guid}/file")]
    public async Task<IActionResult> DeleteFile(Guid areaId, Guid id)
    {
        await service.DeleteFileAsync(areaId, id);
        return NoContent();
    }
}