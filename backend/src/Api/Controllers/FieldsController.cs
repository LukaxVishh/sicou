using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;

namespace Sicou.Api.Controllers;

[ApiController]
[Authorize]
public class FieldsController : ControllerBase
{
    private readonly IFieldDefinitionService _fieldService;

    public FieldsController(IFieldDefinitionService fieldService)
    {
        _fieldService = fieldService;
    }

    [HttpGet("api/areas/{areaId:guid}/fields")]
    public async Task<IActionResult> GetByAreaId(Guid areaId)
    {
        try
        {
            var response = await _fieldService.GetByAreaIdAsync(areaId);
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("api/fields/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var response = await _fieldService.GetByIdAsync(id);
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("api/areas/{areaId:guid}/fields")]
    public async Task<IActionResult> Create(Guid areaId, [FromBody] CreateFieldDefinitionRequest request)
    {
        try
        {
            var response = await _fieldService.CreateAsync(areaId, request);
            return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
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

    [HttpPut("api/fields/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateFieldDefinitionRequest request)
    {
        try
        {
            var response = await _fieldService.UpdateAsync(id, request);
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
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

    [HttpDelete("api/fields/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _fieldService.DeleteAsync(id);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
