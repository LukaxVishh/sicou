using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;
using Sicou.Domain.Enums;

namespace Sicou.Api.Controllers;

[ApiController]
[Authorize]
public class ProcessesController : ControllerBase
{
    private readonly IProcessInstanceService _instanceService;

    public ProcessesController(IProcessInstanceService instanceService)
    {
        _instanceService = instanceService;
    }

    [HttpGet("api/areas/{areaId:guid}/processes")]
    public async Task<IActionResult> GetAreaProcesses(Guid areaId, [FromQuery] ProcessStatus? status = null)
    {
        try
        {
            var response = await _instanceService.GetAreaProcessesAsync(areaId, status);
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

    [HttpGet("api/processes/my")]
    public async Task<IActionResult> GetMyProcesses()
    {
        try
        {
            var response = await _instanceService.GetMyProcessesAsync();
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
    }

    [HttpGet("api/processes/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var response = await _instanceService.GetByIdAsync(id);
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

    [HttpPost("api/processes")]
    public async Task<IActionResult> Create([FromBody] CreateProcessInstanceRequest request)
    {
        try
        {
            var response = await _instanceService.CreateAsync(request);
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

    [HttpPut("api/processes/{id:guid}/draft")]
    public async Task<IActionResult> UpdateDraft(Guid id, [FromBody] UpdateProcessDraftRequest request)
    {
        try
        {
            var response = await _instanceService.UpdateDraftAsync(id, request);
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

    [HttpPost("api/processes/{id:guid}/protocol")]
    public async Task<IActionResult> Protocol(Guid id, [FromBody] ProtocolProcessRequest request)
    {
        try
        {
            var response = await _instanceService.ProtocolAsync(id, request);
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

    [HttpPost("api/processes/{id:guid}/advance")]
    public async Task<IActionResult> Advance(Guid id, [FromBody] AdvanceProcessRequest request)
    {
        try
        {
            var response = await _instanceService.AdvanceAsync(id, request);
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

    [HttpPost("api/processes/{id:guid}/return")]
    public async Task<IActionResult> Return(Guid id, [FromBody] ReturnProcessRequest request)
    {
        try
        {
            var response = await _instanceService.ReturnAsync(id, request);
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

    [HttpPost("api/processes/{id:guid}/restart")]
    public async Task<IActionResult> Restart(Guid id, [FromBody] RestartProcessRequest request)
    {
        try
        {
            var response = await _instanceService.RestartAsync(id, request);
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

    [HttpPost("api/processes/{id:guid}/comments")]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] AddProcessCommentRequest request)
    {
        try
        {
            var response = await _instanceService.AddCommentAsync(id, request);
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
}
