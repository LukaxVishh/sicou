using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Infrastructure.Automations;

namespace Sicou.Api.Controllers;

[ApiController, Authorize, Route("api/automations")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AutomationsController(AutomationService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AutomationDashboardResponse>> Dashboard([FromQuery] Guid? companyId, CancellationToken ct) => await service.DashboardAsync(companyId, ct);

    [HttpPost, Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    [ProducesResponseType(typeof(Automation), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(AutomationSettings request, CancellationToken ct)
    {
        var automation = await service.CreateAsync(request, ct);
        return Created($"/api/automations/{automation.Id}/runs", automation);
    }

    [HttpPut("{id:guid}"), Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    public async Task<ActionResult<Automation>> Update(Guid id, AutomationSettings request, CancellationToken ct) => await service.UpdateAsync(id, request, ct);

    [HttpGet("{id:guid}/runs")]
    public async Task<ActionResult<AutomationHistoryResponse>> History(Guid id, [FromQuery, Range(1, int.MaxValue)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 25, [FromQuery] string? status = null, CancellationToken ct = default)
        => await service.HistoryAsync(id, page, pageSize, status, ct);

    [HttpPost("{id:guid}/runs")]
    [ProducesResponseType(typeof(AutomationRunResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(AutomationRunResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Start(Guid id, StartAutomationRunRequest request, CancellationToken ct)
    {
        var result = await service.StartAsync(id, request, ct);
        return result.Created ? StatusCode(StatusCodes.Status201Created, result.Run) : Ok(result.Run);
    }

    [HttpPost("runs/{id:guid}/heartbeat")]
    public async Task<ActionResult<AutomationRunResponse>> Heartbeat(Guid id, CancellationToken ct) => await service.UpdateRunAsync(id, null, ct);

    [HttpPost("runs/{id:guid}/complete")]
    public async Task<ActionResult<AutomationRunResponse>> Complete(Guid id, CompleteAutomationRunRequest request, CancellationToken ct) => await service.UpdateRunAsync(id, request, ct);

    [HttpPost("alerts/{id:guid}/acknowledge"), Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    public async Task<IActionResult> Acknowledge(Guid id, CancellationToken ct)
    {
        await service.AcknowledgeAsync(id, ct);
        return NoContent();
    }
}
