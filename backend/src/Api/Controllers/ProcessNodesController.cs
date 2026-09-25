using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;

namespace Sicou.Api.Controllers;

[ApiController]
[Authorize]
public class ProcessNodesController : ControllerBase
{
    private readonly IProcessNodeService _nodeService;

    public ProcessNodesController(IProcessNodeService nodeService)
    {
        _nodeService = nodeService;
    }

    [HttpGet("api/areas/{areaId:guid}/process-nodes")]
    public async Task<IActionResult> GetByAreaId(Guid areaId)
    {
        try
        {
            var response = await _nodeService.GetByAreaIdAsync(areaId);
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

    [HttpGet("api/process-nodes/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var response = await _nodeService.GetByIdAsync(id);
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

    [HttpPost("api/areas/{areaId:guid}/process-nodes")]
    public async Task<IActionResult> Create(Guid areaId, [FromBody] CreateProcessNodeRequest request)
    {
        try
        {
            var response = await _nodeService.CreateAsync(areaId, request);
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

    [HttpPut("api/process-nodes/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProcessNodeRequest request)
    {
        try
        {
            var response = await _nodeService.UpdateAsync(id, request);
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

    [HttpDelete("api/process-nodes/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _nodeService.DeleteAsync(id);
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
