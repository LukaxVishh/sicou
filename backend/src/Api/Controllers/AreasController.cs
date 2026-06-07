using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Areas;
using Sicou.Domain.Constants;

namespace Sicou.Api.Controllers;

[ApiController]
[Authorize(Roles = SystemRoles.SuperAdmin)]
public class AreasController : ControllerBase
{
    private readonly IAreaService _areaService;

    public AreasController(IAreaService areaService)
    {
        _areaService = areaService;
    }

    [HttpPost("api/companies/{companyId:guid}/areas")]
    public async Task<IActionResult> Create(
        Guid companyId,
        [FromBody] CreateAreaRequest request)
    {
        try
        {
            var response = await _areaService.CreateAsync(companyId, request);
            return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("api/companies/{companyId:guid}/areas")]
    public async Task<IActionResult> GetByCompanyId(Guid companyId)
    {
        try
        {
            var response = await _areaService.GetByCompanyIdAsync(companyId);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("api/areas/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var response = await _areaService.GetByIdAsync(id);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPut("api/areas/{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateAreaRequest request)
    {
        try
        {
            var response = await _areaService.UpdateAsync(id, request);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("api/areas/{id:guid}/modules")]
    public async Task<IActionResult> UpdateModules(
        Guid id,
        [FromBody] UpdateAreaModulesRequest request)
    {
        try
        {
            var response = await _areaService.UpdateModulesAsync(id, request);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("api/areas/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _areaService.DeleteAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}