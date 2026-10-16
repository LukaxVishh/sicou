using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;

namespace Sicou.Api.Controllers;

[ApiController]
[Authorize]
public class UserProcessNodesController : ControllerBase
{
    private readonly IUserProcessNodeService _service;

    public UserProcessNodesController(IUserProcessNodeService service)
    {
        _service = service;
    }

    [HttpGet("api/users/me/process-nodes")]
    public async Task<IActionResult> GetMyNodes()
    {
        try
        {
            var nodes = await _service.GetMyNodesAsync();
            return Ok(nodes);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
    }

    [HttpGet("api/users/{userId}/process-nodes")]
    public async Task<IActionResult> GetNodesByUserId(string userId)
    {
        try
        {
            var nodes = await _service.GetNodesByUserIdAsync(userId);
            return Ok(nodes);
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

    [HttpPut("api/users/{userId}/process-nodes")]
    public async Task<IActionResult> AssignNodesToUser(string userId, [FromBody] AssignUserProcessNodesRequest request)
    {
        try
        {
            var nodes = await _service.AssignNodesToUserAsync(userId, request);
            return Ok(nodes);
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

    [HttpGet("api/process-nodes/{processNodeId:guid}/users")]
    public async Task<IActionResult> GetUsersByNodeId(Guid processNodeId)
    {
        try
        {
            var users = await _service.GetUsersByNodeIdAsync(processNodeId);
            return Ok(users);
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

    [HttpPut("api/process-nodes/{processNodeId:guid}/users")]
    public async Task<IActionResult> AssignUsersToNode(Guid processNodeId, [FromBody] AssignProcessNodeUsersRequest request)
    {
        try
        {
            var users = await _service.AssignUsersToNodeAsync(processNodeId, request);
            return Ok(users);
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
