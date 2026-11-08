using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Integrations;
using Sicou.Application.Responses.Integrations;
using Sicou.Domain.Constants;

namespace Sicou.Api.Controllers;

/// <summary>
/// Gestão das integrações (UC-020). Exclusivo para sessão web (JWT) de Super Admin, Desenvolvedor
/// ou Admin da Empresa: uma integração nunca cria, renova ou revoga integrações.
/// </summary>
[ApiController]
[Route("api/integrations")]
[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme,
    Roles = $"{SystemRoles.PlatformAdmins},{SystemRoles.CompanyAdmin}")]
public class IntegrationTokensController(IIntegrationTokenService service) : ControllerBase
{
    /// <summary>Escopos disponíveis para os tokens.</summary>
    [HttpGet("scopes")]
    public ActionResult<IReadOnlyList<IntegrationScopeResponse>> Scopes() => Ok(service.GetScopes());

    /// <summary>Integrações visíveis ao administrador (sem segredo nem hash). <c>companyId</c> filtra por empresa.</summary>
    [HttpGet("tokens")]
    public async Task<ActionResult<IReadOnlyList<IntegrationTokenResponse>>> Tokens([FromQuery] Guid? companyId)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await service.GetTokensAsync(companyId));
    }

    /// <summary>Cadastra uma integração (nome, sistema externo e escopos). O segredo <c>sic_...</c> é retornado somente nesta resposta.</summary>
    [HttpPost("tokens")]
    [ProducesResponseType<CreatedIntegrationTokenResponse>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateIntegrationTokenRequest request)
    {
        Response.Headers.CacheControl = "no-store";
        var created = await service.CreateAsync(request);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>Renova o token (UC-020/E1): gera novo segredo e nova validade; o segredo anterior deixa de valer.</summary>
    [HttpPost("tokens/{id:guid}/renew")]
    [ProducesResponseType<CreatedIntegrationTokenResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Renew(Guid id)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await service.RenewAsync(id));
    }

    /// <summary>Revoga imediatamente a integração. Repetir a chamada mantém a revogação.</summary>
    [HttpDelete("tokens/{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id)
    {
        await service.RevokeAsync(id);
        return NoContent();
    }

    /// <summary>Log de auditoria das chamadas feitas com os tokens visíveis.</summary>
    [HttpGet("calls")]
    public async Task<ActionResult<IntegrationCallPageResponse>> Calls(
        [FromQuery] Guid? tokenId, [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        Response.Headers.CacheControl = "no-store";
        return Ok(await service.GetCallsAsync(tokenId, page, pageSize));
    }
}
