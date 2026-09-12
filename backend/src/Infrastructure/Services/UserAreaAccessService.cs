using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.UserAreaAccesses;
using Sicou.Application.Responses.UserAreaAccesses;
using Sicou.Domain.Constants;
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
    private readonly ICurrentUserService _currentUserService;

    public UserAreaAccessService(
        IUserAreaAccessRepository repository,
        ICompanyRepository companyRepository,
        IAreaRepository areaRepository,
        IUnitRepository unitRepository,
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUserService)
    {
        _repository = repository;
        _companyRepository = companyRepository;
        _areaRepository = areaRepository;
        _unitRepository = unitRepository;
        _userManager = userManager;
        _currentUserService = currentUserService;
    }

    public async Task<UserAreaAccessResponse> CreateAsync(CreateUserAreaAccessRequest request)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        if (string.IsNullOrWhiteSpace(request.UserId))
            throw new InvalidOperationException("O usuário é obrigatório.");

        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user is null)
            throw new KeyNotFoundException("Usuário não encontrado.");

        if (!user.IsActive)
            throw new InvalidOperationException("Não é possível criar acesso para um usuário inativo.");

        var targetCompanyId = request.CompanyId;
        if (!isSuperAdmin)
        {
            if (!currentUser.CompanyId.HasValue || currentUser.CompanyId.Value != targetCompanyId)
                throw new UnauthorizedAccessException("Você só pode configurar acessos para a empresa que administra.");

            if (user.CompanyId.HasValue && user.CompanyId.Value != currentUser.CompanyId.Value)
                throw new UnauthorizedAccessException("O usuário pertence a outra empresa.");
        }

        var company = await _companyRepository.GetByIdAsync(targetCompanyId);
        if (company is null || !company.IsActive)
            throw new KeyNotFoundException("Empresa não encontrada ou inativa.");

        var area = await _areaRepository.GetByIdAsync(request.AreaId);
        if (area is null || !area.IsActive)
            throw new KeyNotFoundException("Área não encontrada ou inativa.");

        if (area.CompanyId != targetCompanyId)
            throw new InvalidOperationException("A área informada não pertence à empresa informada.");

        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);
            if (unit is null || !unit.IsActive)
                throw new KeyNotFoundException("Unidade não encontrada ou inativa.");

            if (unit.CompanyId != targetCompanyId)
                throw new InvalidOperationException("A unidade informada não pertence à empresa informada.");
        }

        var existingAccess = await _repository.GetByUserCompanyUnitAreaAsync(
            request.UserId,
            targetCompanyId,
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
            return await MapToResponseAsync(reactivated!);
        }

        var access = new UserAreaAccess
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            CompanyId = targetCompanyId,
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
        return await MapToResponseAsync(created!);
    }

    public async Task<UserAreaAccessResponse?> GetByIdAsync(Guid id)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var access = await _repository.GetByIdAsync(id);
        if (access is null)
            return null;

        if (!isSuperAdmin && access.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para visualizar este acesso.");

        return await MapToResponseAsync(access);
    }

    public async Task<List<UserAreaAccessResponse>> GetByUserIdAsync(string userId)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var targetUser = await _userManager.FindByIdAsync(userId);
        if (targetUser is null)
            return new List<UserAreaAccessResponse>();

        if (!isSuperAdmin && targetUser.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para visualizar os acessos deste usuário.");

        var accesses = await _repository.GetByUserIdAsync(userId);
        var responses = new List<UserAreaAccessResponse>();
        foreach (var access in accesses)
        {
            responses.Add(await MapToResponseAsync(access, targetUser));
        }

        return responses;
    }

    public async Task<List<UserAreaAccessResponse>> GetByCompanyIdAsync(Guid companyId)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        if (!isSuperAdmin && currentUser.CompanyId != companyId)
            throw new UnauthorizedAccessException("Você não tem permissão para visualizar acessos de outra empresa.");

        var accesses = await _repository.GetByCompanyIdAsync(companyId);
        var responses = new List<UserAreaAccessResponse>();
        foreach (var access in accesses)
        {
            responses.Add(await MapToResponseAsync(access));
        }

        return responses;
    }

    public async Task<UserAreaAccessResponse?> UpdateAsync(Guid id, UpdateUserAreaAccessRequest request)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var access = await _repository.GetByIdAsync(id);
        if (access is null)
            return null;

        if (!isSuperAdmin && access.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para editar este acesso.");

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
        return await MapToResponseAsync(updated!);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var access = await _repository.GetByIdAsync(id);
        if (access is null)
            return false;

        if (!isSuperAdmin && access.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para inativar este acesso.");

        access.IsActive = false;
        access.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(access);
        await _repository.SaveChangesAsync();

        return true;
    }

    private async Task<ApplicationUser> GetActiveCurrentUserAsync()
    {
        if (string.IsNullOrWhiteSpace(_currentUserService.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var user = await _userManager.FindByIdAsync(_currentUserService.UserId);
        if (user is null || !user.IsActive)
            throw new UnauthorizedAccessException("Usuário atual não encontrado ou inativo.");

        return user;
    }

    private async Task<UserAreaAccessResponse> MapToResponseAsync(UserAreaAccess access, ApplicationUser? knownUser = null)
    {
        var targetUser = knownUser ?? await _userManager.FindByIdAsync(access.UserId);

        return new UserAreaAccessResponse
        {
            Id = access.Id,
            UserId = access.UserId,
            UserName = targetUser?.FullName,
            UserEmail = targetUser?.Email,
            CompanyId = access.CompanyId,
            CompanyName = access.Company?.Name ?? string.Empty,
            UnitId = access.UnitId,
            UnitName = access.Unit?.Name,
            AreaId = access.AreaId,
            AreaName = access.Area?.Name ?? string.Empty,
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