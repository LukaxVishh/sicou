using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Users;
using Sicou.Application.Responses.Users;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly ICompanyRepository _companyRepository;
    private readonly IUnitRepository _unitRepository;

    public UserService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        ICompanyRepository companyRepository,
        IUnitRepository unitRepository)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _companyRepository = companyRepository;
        _unitRepository = unitRepository;
    }

    public async Task<UserResponse> CreateAsync(CreateUserRequest request)
    {
        var existingUser = await _userManager.FindByEmailAsync(request.Email);

        if (existingUser is not null)
            throw new Exception("Já existe um usuário cadastrado com este e-mail.");

        if (request.CompanyId.HasValue)
        {
            var company = await _companyRepository.GetByIdAsync(request.CompanyId.Value);

            if (company is null)
                throw new Exception("Empresa não encontrada.");
        }

        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);

            if (unit is null)
                throw new Exception("Unidade não encontrada.");

            if (request.CompanyId.HasValue && unit.CompanyId != request.CompanyId.Value)
                throw new Exception("A unidade informada não pertence à empresa informada.");
        }

        foreach (var role in request.Roles)
        {
            var roleExists = await _roleManager.RoleExistsAsync(role);

            if (!roleExists)
                throw new Exception($"Role inválida: {role}");
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName,
            CompanyId = request.CompanyId,
            UnitId = request.UnitId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
            throw new Exception(string.Join(" | ", result.Errors.Select(x => x.Description)));

        if (request.Roles.Count > 0)
        {
            var roleResult = await _userManager.AddToRolesAsync(user, request.Roles);

            if (!roleResult.Succeeded)
                throw new Exception(string.Join(" | ", roleResult.Errors.Select(x => x.Description)));
        }

        return await MapToResponseAsync(user);
    }

    public async Task<List<UserResponse>> GetAllAsync()
    {
        var users = await _userManager.Users
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
        var user = await _userManager.FindByIdAsync(id);

        if (user is null)
            return null;

        return await MapToResponseAsync(user);
    }

    public async Task<UserResponse?> UpdateAsync(string id, UpdateUserRequest request)
    {
        var user = await _userManager.FindByIdAsync(id);

        if (user is null)
            return null;

        if (request.CompanyId.HasValue)
        {
            var company = await _companyRepository.GetByIdAsync(request.CompanyId.Value);

            if (company is null)
                throw new Exception("Empresa não encontrada.");
        }

        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);

            if (unit is null)
                throw new Exception("Unidade não encontrada.");

            if (request.CompanyId.HasValue && unit.CompanyId != request.CompanyId.Value)
                throw new Exception("A unidade informada não pertence à empresa informada.");
        }

        user.FullName = request.FullName;
        user.CompanyId = request.CompanyId;
        user.UnitId = request.UnitId;
        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);

        if (!result.Succeeded)
            throw new Exception(string.Join(" | ", result.Errors.Select(x => x.Description)));

        return await MapToResponseAsync(user);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var user = await _userManager.FindByIdAsync(id);

        if (user is null)
            return false;

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);

        if (!result.Succeeded)
            throw new Exception(string.Join(" | ", result.Errors.Select(x => x.Description)));

        return true;
    }

    public async Task<UserResponse?> UpdateRolesAsync(string id, UpdateUserRolesRequest request)
    {
        var user = await _userManager.FindByIdAsync(id);

        if (user is null)
            return null;

        foreach (var role in request.Roles)
        {
            var roleExists = await _roleManager.RoleExistsAsync(role);

            if (!roleExists)
                throw new Exception($"Role inválida: {role}");
        }

        var currentRoles = await _userManager.GetRolesAsync(user);

        var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);

        if (!removeResult.Succeeded)
            throw new Exception(string.Join(" | ", removeResult.Errors.Select(x => x.Description)));

        if (request.Roles.Count > 0)
        {
            var addResult = await _userManager.AddToRolesAsync(user, request.Roles);

            if (!addResult.Succeeded)
                throw new Exception(string.Join(" | ", addResult.Errors.Select(x => x.Description)));
        }

        user.UpdatedAt = DateTime.UtcNow;

        await _userManager.UpdateAsync(user);

        return await MapToResponseAsync(user);
    }

    private async Task<UserResponse> MapToResponseAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);

        return new UserResponse
        {
            Id = user.Id.ToString(),
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            IsActive = user.IsActive,
            CompanyId = user.CompanyId,
            UnitId = user.UnitId,
            Roles = roles.ToList(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}