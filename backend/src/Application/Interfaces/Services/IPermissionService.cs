namespace Sicou.Application.Interfaces.Services;

public interface IPermissionService
{
    Task<bool> CanManageCompanyAsync(string userId, Guid companyId);

    Task<bool> CanViewAreaAsync(string userId, Guid areaId);

    Task<bool> CanManageAreaAsync(string userId, Guid areaId);

    Task<bool> CanPublishInformativeAsync(string userId, Guid areaId);

    Task<bool> CanManageGuideAsync(string userId, Guid areaId);

    Task<bool> CanManageWorkflowAsync(string userId, Guid areaId);

    Task<bool> CanHandleWorkflowAsync(string userId, Guid areaId);
}