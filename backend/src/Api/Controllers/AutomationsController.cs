using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Sicou.Infrastructure.Automations;

namespace Sicou.Api.Controllers;

// Swagger presents the module as "Workflows" (the proposal's term). Routes, scopes
// (automations:*) and storage keep their names so installed agents and tokens keep working.
[ApiController, Authorize, Route("api/automations"), Tags("Workflows")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AutomationsController(AutomationService service) : ControllerBase
{
    [HttpGet]
    [EndpointSummary("Listar workflows, indicadores e alertas")]
    [EndpointDescription("Workflows visíveis conforme perfil e vínculo, resumo dos últimos 7 dias e os 50 alertas mais recentes. companyId é opcional para administradores da plataforma.")]
    public async Task<ActionResult<AutomationDashboardResponse>> Dashboard([FromQuery] Guid? companyId, CancellationToken ct) => await service.DashboardAsync(companyId, ct);

    [HttpPost, Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    [EndpointSummary("Cadastrar workflow")]
    [EndpointDescription("Somente sessão JWT. O workflow pertence ao usuário e ao seu vínculo atual. Limites: tempo sem atividade, duração esperada e intervalo esperado de início (opcional).")]
    [ProducesResponseType(typeof(Automation), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(AutomationSettings request, CancellationToken ct)
    {
        var automation = await service.CreateAsync(request, ct);
        return Created($"/api/automations/{automation.Id}/runs", automation);
    }

    [HttpPut("{id:guid}"), Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    [EndpointSummary("Atualizar, pausar ou retomar workflow")]
    [EndpointDescription("Somente sessão JWT do proprietário. {id} é o identificador do workflow. Pausar bloqueia novos inícios; execuções em andamento continuam monitoradas.")]
    public async Task<ActionResult<Automation>> Update(Guid id, AutomationSettings request, CancellationToken ct) => await service.UpdateAsync(id, request, ct);

    [HttpGet("{id:guid}/runs")]
    [EndpointSummary("Consultar histórico de execuções do workflow")]
    [EndpointDescription("{id} é o identificador do workflow. Retorna status, data e hora, duração, mensagem e logs, com paginação e filtro por status.")]
    public async Task<ActionResult<AutomationHistoryResponse>> History(Guid id, [FromQuery, Range(1, int.MaxValue)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 25, [FromQuery] string? status = null, CancellationToken ct = default)
        => await service.HistoryAsync(id, page, pageSize, status, ct);

    [HttpPost("{id:guid}/runs")]
    [EndpointSummary("Registrar início de execução do workflow")]
    [EndpointDescription("{id} é o identificador do workflow. externalId é um UUID gerado pelo agente: repetir a mesma chave e host devolve a mesma execução (200). O Sicou não executa nem agenda o workflow; o agente local o executa.")]
    [ProducesResponseType(typeof(AutomationRunResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(AutomationRunResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Start(Guid id, StartAutomationRunRequest request, CancellationToken ct)
    {
        var result = await service.StartAsync(id, request, ct);
        return result.Created ? StatusCode(StatusCodes.Status201Created, result.Run) : Ok(result.Run);
    }

    [HttpPost("runs/{id:guid}/heartbeat")]
    [EndpointSummary("Informar atividade da execução")]
    [EndpointDescription("{id} é o identificador da execução retornado no início. Recupera uma execução marcada como sem comunicação.")]
    public async Task<ActionResult<AutomationRunResponse>> Heartbeat(Guid id, CancellationToken ct) => await service.UpdateRunAsync(id, null, ct);

    [HttpPost("runs/{id:guid}/complete")]
    [EndpointSummary("Registrar resultado da execução")]
    [EndpointDescription("{id} é o identificador da execução. Informe succeeded, exitCode, mensagem e logs. Repetir o mesmo resultado é idempotente; falha gera alerta e notificação ao responsável.")]
    public async Task<ActionResult<AutomationRunResponse>> Complete(Guid id, CompleteAutomationRunRequest request, CancellationToken ct) => await service.UpdateRunAsync(id, request, ct);

    [HttpPost("alerts/{id:guid}/acknowledge"), Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]
    [EndpointSummary("Reconhecer alerta de workflow")]
    [EndpointDescription("Somente sessão JWT. {id} é o identificador do alerta. O reconhecimento não apaga o histórico.")]
    public async Task<IActionResult> Acknowledge(Guid id, CancellationToken ct)
    {
        await service.AcknowledgeAsync(id, ct);
        return NoContent();
    }
}
