using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sicou.Domain.Constants;

namespace Sicou.Api.Controllers;

[ApiController]
[Route("api/area-policy-test")]
public class AreaPolicyTestController : ControllerBase
{
    [HttpGet("{areaId:guid}/can-view")]
    [Authorize(Policy = SystemPolicies.CanViewArea)]
    public IActionResult CanView(Guid areaId)
    {
        return Ok(new
        {
            message = "Usuário tem permissão para visualizar esta área.",
            areaId
        });
    }

    [HttpGet("{areaId:guid}/can-manage")]
    [Authorize(Policy = SystemPolicies.CanManageArea)]
    public IActionResult CanManage(Guid areaId)
    {
        return Ok(new
        {
            message = "Usuário tem permissão para gerenciar esta área.",
            areaId
        });
    }

    [HttpGet("{areaId:guid}/can-publish-informative")]
    [Authorize(Policy = SystemPolicies.CanPublishInformative)]
    public IActionResult CanPublishInformative(Guid areaId)
    {
        return Ok(new
        {
            message = "Usuário tem permissão para publicar informativos nesta área.",
            areaId
        });
    }

    [HttpGet("{areaId:guid}/can-manage-guide")]
    [Authorize(Policy = SystemPolicies.CanManageGuide)]
    public IActionResult CanManageGuide(Guid areaId)
    {
        return Ok(new
        {
            message = "Usuário tem permissão para gerenciar o orientador desta área.",
            areaId
        });
    }

    [HttpGet("{areaId:guid}/can-manage-workflow")]
    [Authorize(Policy = SystemPolicies.CanManageWorkflow)]
    public IActionResult CanManageWorkflow(Guid areaId)
    {
        return Ok(new
        {
            message = "Usuário tem permissão para gerenciar workflows desta área.",
            areaId
        });
    }

    [HttpGet("{areaId:guid}/can-handle-workflow")]
    [Authorize(Policy = SystemPolicies.CanHandleWorkflow)]
    public IActionResult CanHandleWorkflow(Guid areaId)
    {
        return Ok(new
        {
            message = "Usuário tem permissão para tratar workflows desta área.",
            areaId
        });
    }
}