using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Units;

namespace Sicou.Api.Controllers;

[ApiController]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly IUnitService _unitService;

    public UnitsController(IUnitService unitService)
    {
        _unitService = unitService;
    }

    [HttpPost("api/companies/{companyId:guid}/units")]
    public async Task<IActionResult> Create(
        Guid companyId,
        [FromBody] CreateUnitRequest request)
    {
        try
        {
            var response = await _unitService.CreateAsync(companyId, request);
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

    [HttpGet("api/companies/{companyId:guid}/units")]
    public async Task<IActionResult> GetByCompanyId(Guid companyId)
    {
        try
        {
            var response = await _unitService.GetByCompanyIdAsync(companyId);
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

    [HttpGet("api/units/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var response = await _unitService.GetByIdAsync(id);
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

    [HttpPut("api/units/{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateUnitRequest request)
    {
        try
        {
            var response = await _unitService.UpdateAsync(id, request);
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

    [HttpDelete("api/units/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _unitService.DeleteAsync(id);
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