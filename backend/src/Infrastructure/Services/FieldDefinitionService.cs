using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class FieldDefinitionService : IFieldDefinitionService
{
    private readonly IFieldDefinitionRepository _fieldRepository;
    private readonly IAreaRepository _areaRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserAreaAccessRepository _userAreaAccessRepository;

    public FieldDefinitionService(
        IFieldDefinitionRepository fieldRepository,
        IAreaRepository areaRepository,
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        IUserAreaAccessRepository userAreaAccessRepository)
    {
        _fieldRepository = fieldRepository;
        _areaRepository = areaRepository;
        _currentUser = currentUser;
        _userManager = userManager;
        _userAreaAccessRepository = userAreaAccessRepository;
    }

    public async Task<IReadOnlyList<FieldDefinitionResponse>> GetByAreaIdAsync(Guid areaId)
    {
        await ValidateAreaAccessAsync(areaId, requireManage: false);
        var fields = await _fieldRepository.GetByAreaIdAsync(areaId);
        return fields.Select(MapToResponse).ToList();
    }

    public async Task<FieldDefinitionResponse> GetByIdAsync(Guid id)
    {
        var field = await _fieldRepository.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Campo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(field.AreaId, requireManage: false);
        return MapToResponse(field);
    }

    public async Task<FieldDefinitionResponse> CreateAsync(Guid areaId, CreateFieldDefinitionRequest request)
    {
        await ValidateAreaAccessAsync(areaId, requireManage: true);

        var code = request.Code.Trim().ToLowerInvariant();
        if (await _fieldRepository.ExistsByCodeAsync(areaId, code))
            throw new InvalidOperationException($"Já existe um campo com o código '{code}' nesta área.");

        var field = new FieldDefinition
        {
            AreaId = areaId,
            Code = code,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Placeholder = request.Placeholder?.Trim(),
            Type = request.Type,
            GlobalOptionsJson = request.GlobalOptionsJson
        };

        await _fieldRepository.AddAsync(field);
        await _fieldRepository.SaveChangesAsync();

        return MapToResponse(field);
    }

    public async Task<FieldDefinitionResponse> UpdateAsync(Guid id, UpdateFieldDefinitionRequest request)
    {
        var field = await _fieldRepository.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Campo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(field.AreaId, requireManage: true);

        field.Name = request.Name.Trim();
        field.Description = request.Description?.Trim();
        field.Placeholder = request.Placeholder?.Trim();
        field.Type = request.Type;
        field.GlobalOptionsJson = request.GlobalOptionsJson;
        field.IsActive = request.IsActive;
        field.UpdatedAt = DateTime.UtcNow;

        _fieldRepository.Update(field);
        await _fieldRepository.SaveChangesAsync();

        return MapToResponse(field);
    }

    public async Task DeleteAsync(Guid id)
    {
        var field = await _fieldRepository.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Campo com ID '{id}' não encontrado.");

        await ValidateAreaAccessAsync(field.AreaId, requireManage: true);

        field.IsActive = false;
        field.UpdatedAt = DateTime.UtcNow;

        _fieldRepository.Update(field);
        await _fieldRepository.SaveChangesAsync();
    }

    private async Task ValidateAreaAccessAsync(Guid areaId, bool requireManage)
    {
        if (string.IsNullOrEmpty(_currentUser.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var user = await _userManager.FindByIdAsync(_currentUser.UserId)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains(SystemRoles.SuperAdmin))
            return;

        var area = await _areaRepository.GetByIdAsync(areaId)
            ?? throw new KeyNotFoundException("Área não encontrada.");

        if (user.CompanyId != area.CompanyId)
            throw new UnauthorizedAccessException("Você não possui permissão para acessar áreas de outra empresa.");

        if (roles.Contains(SystemRoles.CompanyAdmin))
            return;

        if (requireManage)
        {
            var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
            var areaAccess = accesses.FirstOrDefault(a => a.AreaId == areaId && a.IsActive);

            if (areaAccess == null || (!areaAccess.CanManageWorkflows && !areaAccess.CanManage))
                throw new UnauthorizedAccessException("Você não possui permissão para gerenciar fluxos ou campos desta área.");
        }
    }

    private static FieldDefinitionResponse MapToResponse(FieldDefinition f) => new()
    {
        Id = f.Id,
        AreaId = f.AreaId,
        Code = f.Code,
        Name = f.Name,
        Description = f.Description,
        Placeholder = f.Placeholder,
        Type = f.Type,
        GlobalOptionsJson = f.GlobalOptionsJson,
        IsActive = f.IsActive,
        CreatedAt = f.CreatedAt
    };
}
