using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Users;
using Sicou.Application.Responses.Users;
using Sicou.Domain.Constants;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly ICompanyRepository _companyRepository;
    private readonly IUnitRepository _unitRepository;
    private readonly ICurrentUserService _currentUserService;

    public UserService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        ICompanyRepository companyRepository,
        IUnitRepository unitRepository,
        ICurrentUserService currentUserService)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _companyRepository = companyRepository;
        _unitRepository = unitRepository;
        _currentUserService = currentUserService;
    }

    public async Task<UserResponse> CreateAsync(CreateUserRequest request)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new InvalidOperationException("O nome completo é obrigatório.");

        if (string.IsNullOrWhiteSpace(request.Email))
            throw new InvalidOperationException("O e-mail é obrigatório.");

        if (string.IsNullOrWhiteSpace(request.Password))
            throw new InvalidOperationException("A senha é obrigatória.");

        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
            throw new InvalidOperationException("Já existe um usuário cadastrado com este e-mail.");

        Guid? targetCompanyId = request.CompanyId;
        if (!isSuperAdmin)
        {
            if (!currentUser.CompanyId.HasValue)
                throw new UnauthorizedAccessException("Seu usuário não está vinculado a uma empresa.");

            targetCompanyId = currentUser.CompanyId.Value;

            if (request.Roles.Contains(SystemRoles.SuperAdmin))
                throw new UnauthorizedAccessException("Você não tem permissão para conceder a role Super Admin.");
        }

        if (targetCompanyId.HasValue)
        {
            var company = await _companyRepository.GetByIdAsync(targetCompanyId.Value);
            if (company is null || !company.IsActive)
                throw new InvalidOperationException("Empresa não encontrada ou inativa.");
        }

        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);
            if (unit is null || !unit.IsActive)
                throw new InvalidOperationException("Unidade não encontrada ou inativa.");

            if (targetCompanyId.HasValue && unit.CompanyId != targetCompanyId.Value)
                throw new InvalidOperationException("A unidade informada não pertence à empresa selecionada.");
        }

        foreach (var role in request.Roles)
        {
            var roleExists = await _roleManager.RoleExistsAsync(role);
            if (!roleExists)
                throw new InvalidOperationException($"Role inválida: {role}");
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName.Trim(),
            CompanyId = targetCompanyId,
            UnitId = request.UnitId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" | ", result.Errors.Select(x => x.Description)));

        if (request.Roles.Count > 0)
        {
            var roleResult = await _userManager.AddToRolesAsync(user, request.Roles);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(string.Join(" | ", roleResult.Errors.Select(x => x.Description)));
        }

        return await MapToResponseAsync(user);
    }

    public async Task<List<UserResponse>> GetAllAsync()
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var query = _userManager.Users.AsNoTracking();

        if (!isSuperAdmin)
        {
            if (!currentUser.CompanyId.HasValue)
                return new List<UserResponse>();

            query = query.Where(u => u.CompanyId == currentUser.CompanyId.Value);
        }

        var users = await query
            .OrderBy(x => x.FullName)
            .ToListAsync();

        var responses = new List<UserResponse>();
        foreach (var user in users)
        {
            responses.Add(await MapToResponseAsync(user));
        }

        return responses;
    }

    public async Task<UserResponse?> GetByIdAsync(string id)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return null;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para visualizar este usuário.");

        return await MapToResponseAsync(user);
    }

    public async Task<UserResponse?> UpdateAsync(string id, UpdateUserRequest request)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return null;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para editar este usuário.");

        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new InvalidOperationException("O nome completo é obrigatório.");

        Guid? targetCompanyId = isSuperAdmin ? request.CompanyId : currentUser.CompanyId;

        if (targetCompanyId.HasValue)
        {
            var company = await _companyRepository.GetByIdAsync(targetCompanyId.Value);
            if (company is null || !company.IsActive)
                throw new InvalidOperationException("Empresa não encontrada ou inativa.");
        }

        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);
            if (unit is null || !unit.IsActive)
                throw new InvalidOperationException("Unidade não encontrada ou inativa.");

            if (targetCompanyId.HasValue && unit.CompanyId != targetCompanyId.Value)
                throw new InvalidOperationException("A unidade informada não pertence à empresa selecionada.");
        }

        // Atualização de e-mail se fornecido e modificado
        if (!string.IsNullOrWhiteSpace(request.Email) && !string.Equals(request.Email, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var emailExists = await _userManager.FindByEmailAsync(request.Email);
            if (emailExists is not null && emailExists.Id != user.Id)
                throw new InvalidOperationException("Já existe outro usuário cadastrado com este e-mail.");

            user.Email = request.Email.Trim();
            user.UserName = request.Email.Trim();
            user.NormalizedEmail = _userManager.NormalizeEmail(request.Email.Trim());
            user.NormalizedUserName = _userManager.NormalizeName(request.Email.Trim());
        }

        user.FullName = request.FullName.Trim();
        user.CompanyId = targetCompanyId;
        user.UnitId = request.UnitId;
        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" | ", result.Errors.Select(x => x.Description)));

        return await MapToResponseAsync(user);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return false;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para inativar este usuário.");

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" | ", result.Errors.Select(x => x.Description)));

        return true;
    }

    public async Task<UserResponse?> UpdateRolesAsync(string id, UpdateUserRolesRequest request)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsInRoleAsync(currentUser, SystemRoles.SuperAdmin);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return null;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para alterar as permissões deste usuário.");

        if (!isSuperAdmin && request.Roles.Contains(SystemRoles.SuperAdmin))
            throw new UnauthorizedAccessException("Você não tem permissão para conceder o perfil Super Admin.");

        foreach (var role in request.Roles)
        {
            var roleExists = await _roleManager.RoleExistsAsync(role);
            if (!roleExists)
                throw new InvalidOperationException($"Role inválida: {role}");
        }

        var currentRoles = await _userManager.GetRolesAsync(user);
        var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
        if (!removeResult.Succeeded)
            throw new InvalidOperationException(string.Join(" | ", removeResult.Errors.Select(x => x.Description)));

        if (request.Roles.Count > 0)
        {
            var addResult = await _userManager.AddToRolesAsync(user, request.Roles);
            if (!addResult.Succeeded)
                throw new InvalidOperationException(string.Join(" | ", addResult.Errors.Select(x => x.Description)));
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        return await MapToResponseAsync(user);
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

    private async Task<UserResponse> MapToResponseAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var company = user.CompanyId.HasValue
            ? await _companyRepository.GetByIdAsync(user.CompanyId.Value)
            : null;
        var unit = user.UnitId.HasValue
            ? await _unitRepository.GetByIdAsync(user.UnitId.Value)
            : null;

        return new UserResponse
        {
            Id = user.Id.ToString(),
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            IsActive = user.IsActive,
            CompanyId = user.CompanyId,
            UnitId = user.UnitId,
            CompanyName = company?.Name,
            UnitName = unit?.Name,
            Roles = roles.ToList(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}