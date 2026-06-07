using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.UserAreaAccesses;
using Sicou.Domain.Constants;

namespace Sicou.Api.Controllers;

[ApiController]
[Route("api/user-area-accesses")]
[Authorize(Roles = $"{SystemRoles.SuperAdmin},{SystemRoles.CompanyAdmin}")]
public class UserAreaAccessesController : ControllerBase
{
    private readonly IUserAreaAccessService _service;

    public UserAreaAccessesController(IUserAreaAccessService service)
    {
        _service = service;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserAreaAccessRequest request)
    {
        var response = await _service.CreateAsync(request);

        return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var response = await _service.GetByIdAsync(id);

        if (response is null)
            return NotFound();

        return Ok(response);
    }

    [HttpGet("by-user/{userId}")]
    public async Task<IActionResult> GetByUserId(string userId)
    {
        var response = await _service.GetByUserIdAsync(userId);

        return Ok(response);
    }

    [HttpGet("by-company/{companyId:guid}")]
    public async Task<IActionResult> GetByCompanyId(Guid companyId)
    {
        var response = await _service.GetByCompanyIdAsync(companyId);

        return Ok(response);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserAreaAccessRequest request)
    {
        var response = await _service.UpdateAsync(id, request);

        if (response is null)
            return NotFound();

        return Ok(response);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _service.DeleteAsync(id);

        if (!deleted)
            return NotFound();

        return NoContent();
    }
}