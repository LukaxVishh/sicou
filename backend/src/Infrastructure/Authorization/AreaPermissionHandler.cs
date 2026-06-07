using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Sicou.Application.Interfaces.Services;
using Sicou.Domain.Constants;

namespace Sicou.Infrastructure.Authorization;

public class AreaPermissionHandler : AuthorizationHandler<AreaPermissionRequirement>
{
    private readonly IPermissionService _permissionService;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AreaPermissionHandler(
        IPermissionService permissionService,
        IHttpContextAccessor httpContextAccessor)
    {
        _permissionService = permissionService;
        _httpContextAccessor = httpContextAccessor;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AreaPermissionRequirement requirement)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userId))
            return;

        var httpContext = _httpContextAccessor.HttpContext;

        if (httpContext is null)
            return;

        var areaIdValue = httpContext.GetRouteValue("areaId")?.ToString();

        if (string.IsNullOrWhiteSpace(areaIdValue))
            return;

        if (!Guid.TryParse(areaIdValue, out var areaId))
            return;

        var hasPermission = requirement.PermissionName switch
        {
            SystemPolicies.CanViewArea =>
                await _permissionService.CanViewAreaAsync(userId, areaId),

            SystemPolicies.CanManageArea =>
                await _permissionService.CanManageAreaAsync(userId, areaId),

            SystemPolicies.CanPublishInformative =>
                await _permissionService.CanPublishInformativeAsync(userId, areaId),

            SystemPolicies.CanManageGuide =>
                await _permissionService.CanManageGuideAsync(userId, areaId),

            SystemPolicies.CanManageWorkflow =>
                await _permissionService.CanManageWorkflowAsync(userId, areaId),

            SystemPolicies.CanHandleWorkflow =>
                await _permissionService.CanHandleWorkflowAsync(userId, areaId),

            _ => false
        };

        if (hasPermission)
            context.Succeed(requirement);
    }
}