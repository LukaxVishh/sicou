using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.UserAreaAccesses;
using Sicou.Application.Responses.UserAreaAccesses;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class UserAreaAccessService : IUserAreaAccessService
{
    private readonly IUserAreaAccessRepository _repository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IAreaRepository _areaRepository;
    private readonly IUnitRepository _unitRepository;
    private readonly UserManager<ApplicationUser> _userManager;

    public UserAreaAccessService(
        IUserAreaAccessRepository repository,
        ICompanyRepository companyRepository,
        IAreaRepository areaRepository,
        IUnitRepository unitRepository,
        UserManager<ApplicationUser> userManager)
    {
        _repository = repository;
        _companyRepository = companyRepository;
        _areaRepository = areaRepository;
        _unitRepository = unitRepository;
        _userManager = userManager;
    }

    public async Task<UserAreaAccessResponse> CreateAsync(CreateUserAreaAccessRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserId))
            throw new InvalidOperationException("O usuário é obrigatório.");

        var user = await _userManager.FindByIdAsync(request.UserId);

        if (user is null)
            throw new KeyNotFoundException("Usuário não encontrado.");

        if (!user.IsActive)
            throw new InvalidOperationException("Não é possível criar acesso para um usuário inativo.");

        var company = await _companyRepository.GetByIdAsync(request.CompanyId);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        if (!company.IsActive)
            throw new InvalidOperationException("Não é possível criar acesso para uma empresa inativa.");

        var area = await _areaRepository.GetByIdAsync(request.AreaId);

        if (area is null)
            throw new KeyNotFoundException("Área não encontrada.");

        if (!area.IsActive)
            throw new InvalidOperationException("Não é possível criar acesso para uma área inativa.");

        if (area.CompanyId != request.CompanyId)
            throw new InvalidOperationException("A área informada não pertence à empresa informada.");

        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);

            if (unit is null)
                throw new KeyNotFoundException("Unidade não encontrada.");

            if (!unit.IsActive)
                throw new InvalidOperationException("Não é possível criar acesso para uma unidade inativa.");

            if (unit.CompanyId != request.CompanyId)
                throw new InvalidOperationException("A unidade informada não pertence à empresa informada.");
        }

        var existingAccess = await _repository.GetByUserCompanyUnitAreaAsync(
            request.UserId,
            request.CompanyId,
            request.UnitId,
            request.AreaId
        );

        if (existingAccess is not null)
        {
            if (existingAccess.IsActive)
                throw new InvalidOperationException("Esse usuário já possui acesso configurado para essa empresa, unidade e área.");

            existingAccess.CanView = request.CanView;
            existingAccess.CanManage = request.CanManage;
            existingAccess.CanPublishInformatives = request.CanPublishInformatives;
            existingAccess.CanManageGuide = request.CanManageGuide;
            existingAccess.CanManageWorkflows = request.CanManageWorkflows;
            existingAccess.CanHandleWorkflowRequests = request.CanHandleWorkflowRequests;
            existingAccess.IsActive = true;
            existingAccess.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(existingAccess);
            await _repository.SaveChangesAsync();

            var reactivated = await _repository.GetByIdAsync(existingAccess.Id);

            return MapToResponse(reactivated!);
        }

        var access = new UserAreaAccess
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            CompanyId = request.CompanyId,
            UnitId = request.UnitId,
            AreaId = request.AreaId,
            CanView = request.CanView,
            CanManage = request.CanManage,
            CanPublishInformatives = request.CanPublishInformatives,
            CanManageGuide = request.CanManageGuide,
            CanManageWorkflows = request.CanManageWorkflows,
            CanHandleWorkflowRequests = request.CanHandleWorkflowRequests,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _repository.AddAsync(access);
        await _repository.SaveChangesAsync();

        var created = await _repository.GetByIdAsync(access.Id);

        return MapToResponse(created!);
    }

    public async Task<UserAreaAccessResponse?> GetByIdAsync(Guid id)
    {
        var access = await _repository.GetByIdAsync(id);

        return access is null ? null : MapToResponse(access);
    }

    public async Task<List<UserAreaAccessResponse>> GetByUserIdAsync(string userId)
    {
        var accesses = await _repository.GetByUserIdAsync(userId);

        return accesses
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<List<UserAreaAccessResponse>> GetByCompanyIdAsync(Guid companyId)
    {
        var accesses = await _repository.GetByCompanyIdAsync(companyId);

        return accesses
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<UserAreaAccessResponse?> UpdateAsync(Guid id, UpdateUserAreaAccessRequest request)
    {
        var access = await _repository.GetByIdAsync(id);

        if (access is null)
            return null;

        access.CanView = request.CanView;
        access.CanManage = request.CanManage;
        access.CanPublishInformatives = request.CanPublishInformatives;
        access.CanManageGuide = request.CanManageGuide;
        access.CanManageWorkflows = request.CanManageWorkflows;
        access.CanHandleWorkflowRequests = request.CanHandleWorkflowRequests;
        access.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(access);
        await _repository.SaveChangesAsync();

        var updated = await _repository.GetByIdAsync(id);

        return MapToResponse(updated!);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var access = await _repository.GetByIdAsync(id);

        if (access is null)
            return false;

        access.IsActive = false;
        access.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(access);
        await _repository.SaveChangesAsync();

        return true;
    }

    private static UserAreaAccessResponse MapToResponse(UserAreaAccess access)
    {
        return new UserAreaAccessResponse
        {
            Id = access.Id,
            UserId = access.UserId,
            CompanyId = access.CompanyId,
            CompanyName = access.Company.Name,
            UnitId = access.UnitId,
            UnitName = access.Unit?.Name,
            AreaId = access.AreaId,
            AreaName = access.Area.Name,
            CanView = access.CanView,
            CanManage = access.CanManage,
            CanPublishInformatives = access.CanPublishInformatives,
            CanManageGuide = access.CanManageGuide,
            CanManageWorkflows = access.CanManageWorkflows,
            CanHandleWorkflowRequests = access.CanHandleWorkflowRequests,
            IsActive = access.IsActive,
            CreatedAt = access.CreatedAt,
            UpdatedAt = access.UpdatedAt
        };
    }
}