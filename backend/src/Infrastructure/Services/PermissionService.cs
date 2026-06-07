using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Services;
using Sicou.Domain.Constants;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class PermissionService : IPermissionService
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public PermissionService(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _userManager = userManager;
    }

    public async Task<bool> CanManageCompanyAsync(string userId, Guid companyId)
    {
        var user = await _userManager.FindByIdAsync(userId);

        if (user is null || !user.IsActive)
            return false;

        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            return true;

        if (await _userManager.IsInRoleAsync(user, SystemRoles.CompanyAdmin))
            return user.CompanyId == companyId;

        return false;
    }

    public async Task<bool> CanViewAreaAsync(string userId, Guid areaId)
    {
        return await HasAreaPermissionAsync(
            userId,
            areaId,
            access => access.CanView);
    }

    public async Task<bool> CanManageAreaAsync(string userId, Guid areaId)
    {
        return await HasAreaPermissionAsync(
            userId,
            areaId,
            access => access.CanManage);
    }

    public async Task<bool> CanPublishInformativeAsync(string userId, Guid areaId)
    {
        return await HasAreaPermissionAsync(
            userId,
            areaId,
            access => access.CanPublishInformatives);
    }

    public async Task<bool> CanManageGuideAsync(string userId, Guid areaId)
    {
        return await HasAreaPermissionAsync(
            userId,
            areaId,
            access => access.CanManageGuide);
    }

    public async Task<bool> CanManageWorkflowAsync(string userId, Guid areaId)
    {
        return await HasAreaPermissionAsync(
            userId,
            areaId,
            access => access.CanManageWorkflows);
    }

    public async Task<bool> CanHandleWorkflowAsync(string userId, Guid areaId)
    {
        return await HasAreaPermissionAsync(
            userId,
            areaId,
            access => access.CanHandleWorkflowRequests);
    }

    private async Task<bool> HasAreaPermissionAsync(
        string userId,
        Guid areaId,
        Func<Sicou.Domain.Entities.UserAreaAccess, bool> permissionSelector)
    {
        var user = await _userManager.FindByIdAsync(userId);

        if (user is null || !user.IsActive)
            return false;

        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            return true;

        var area = await _context.Areas
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == areaId && x.IsActive);

        if (area is null)
            return false;

        if (await _userManager.IsInRoleAsync(user, SystemRoles.CompanyAdmin))
            return user.CompanyId == area.CompanyId;

        var access = await _context.UserAreaAccesses
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.UserId == userId &&
                x.AreaId == areaId &&
                x.IsActive);

        if (access is null)
            return false;

        return permissionSelector(access);
    }
}