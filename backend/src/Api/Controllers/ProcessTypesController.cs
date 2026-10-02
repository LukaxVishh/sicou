using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;

namespace Sicou.Api.Controllers;

[ApiController]
[Authorize]
public class ProcessTypesController : ControllerBase
{
    private readonly IProcessTypeService _processTypeService;

    public ProcessTypesController(IProcessTypeService processTypeService)
    {
        _processTypeService = processTypeService;
    }

    [HttpGet("api/areas/{areaId:guid}/process-types")]
    public async Task<IActionResult> GetByAreaId(Guid areaId)
    {
        try
        {
            var response = await _processTypeService.GetByAreaIdAsync(areaId);
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

    [HttpGet("api/process-types/available")]
    public async Task<IActionResult> GetAvailableForOpening()
    {
        try
        {
            var response = await _processTypeService.GetAvailableForOpeningAsync();
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("api/process-types/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var response = await _processTypeService.GetByIdAsync(id);
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

    [HttpPost("api/areas/{areaId:guid}/process-types")]
    public async Task<IActionResult> Create(Guid areaId, [FromBody] CreateProcessTypeRequest request)
    {
        try
        {
            var response = await _processTypeService.CreateAsync(areaId, request);
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

    [HttpPut("api/process-types/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProcessTypeRequest request)
    {
        try
        {
            var response = await _processTypeService.UpdateAsync(id, request);
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

    [HttpPost("api/process-types/{id:guid}/clone-version")]
    public async Task<IActionResult> CloneToNewVersion(Guid id)
    {
        try
        {
            var response = await _processTypeService.CloneToNewVersionAsync(id);
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

    [HttpPost("api/process-types/{id:guid}/new-version-scratch")]
    public async Task<IActionResult> CreateNewVersionFromScratch(Guid id)
    {
        try
        {
            var response = await _processTypeService.CreateNewVersionFromScratchAsync(id);
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

    [HttpPost("api/process-types/{id:guid}/homologate")]
    public async Task<IActionResult> Homologate(Guid id)
    {
        try
        {
            var response = await _processTypeService.HomologateAsync(id);
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

    [HttpPost("api/process-types/{id:guid}/inactivate")]
    public async Task<IActionResult> Inactivate(Guid id)
    {
        try
        {
            var response = await _processTypeService.InactivateAsync(id);
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

    [HttpDelete("api/process-types/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _processTypeService.DeleteAsync(id);
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
