using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Units;
using Sicou.Application.Responses.Units;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class UnitService : IUnitService
{
    private readonly IUnitRepository _unitRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly UserManager<ApplicationUser> _userManager;

    public UnitService(
        IUnitRepository unitRepository,
        ICompanyRepository companyRepository,
        ICurrentUserService currentUserService,
        UserManager<ApplicationUser> userManager)
    {
        _unitRepository = unitRepository;
        _companyRepository = companyRepository;
        _currentUserService = currentUserService;
        _userManager = userManager;
    }

    public async Task<UnitResponse> CreateAsync(Guid companyId, CreateUnitRequest request)
    {
        await ValidateCompanyAccessAsync(companyId, writeOperation: true);

        var company = await _companyRepository.GetByIdAsync(companyId);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        if (!company.IsActive)
            throw new InvalidOperationException("Não é possível cadastrar unidade para uma empresa inativa.");

        var name = request.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("O nome da unidade é obrigatório.");

        var existsName = await _unitRepository.ExistsByNameAsync(companyId, name);

        if (existsName)
            throw new InvalidOperationException("Já existe uma unidade cadastrada com este nome nesta empresa.");

        var code = string.IsNullOrWhiteSpace(request.Code)
            ? null
            : request.Code.Trim();

        if (!string.IsNullOrWhiteSpace(code))
        {
            var existsCode = await _unitRepository.ExistsByCodeAsync(companyId, code);

            if (existsCode)
                throw new InvalidOperationException("Já existe uma unidade cadastrada com este código nesta empresa.");
        }

        var unit = new Unit
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Name = name,
            Code = code,
            City = string.IsNullOrWhiteSpace(request.City) ? null : request.City.Trim(),
            State = string.IsNullOrWhiteSpace(request.State) ? null : request.State.Trim().ToUpper(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _unitRepository.AddAsync(unit);
        await _unitRepository.SaveChangesAsync();

        unit.Company = company;

        return MapToResponse(unit);
    }

    public async Task<IReadOnlyList<UnitResponse>> GetByCompanyIdAsync(Guid companyId)
    {
        await ValidateCompanyAccessAsync(companyId, writeOperation: false);

        var company = await _companyRepository.GetByIdAsync(companyId);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        var units = await _unitRepository.GetByCompanyIdAsync(companyId);

        return units
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<UnitResponse> GetByIdAsync(Guid id)
    {
        var unit = await _unitRepository.GetByIdAsync(id);

        if (unit is null)
            throw new KeyNotFoundException("Unidade não encontrada.");

        await ValidateCompanyAccessAsync(unit.CompanyId, writeOperation: false);

        return MapToResponse(unit);
    }

    public async Task<UnitResponse> UpdateAsync(Guid id, UpdateUnitRequest request)
    {
        var unit = await _unitRepository.GetByIdAsync(id);

        if (unit is null)
            throw new KeyNotFoundException("Unidade não encontrada.");

        await ValidateCompanyAccessAsync(unit.CompanyId, writeOperation: true);

        var name = request.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("O nome da unidade é obrigatório.");

        var existsName = await _unitRepository.ExistsByNameAsync(unit.CompanyId, name, id);

        if (existsName)
            throw new InvalidOperationException("Já existe outra unidade cadastrada com este nome nesta empresa.");

        var code = string.IsNullOrWhiteSpace(request.Code)
            ? null
            : request.Code.Trim();

        if (!string.IsNullOrWhiteSpace(code))
        {
            var existsCode = await _unitRepository.ExistsByCodeAsync(unit.CompanyId, code, id);

            if (existsCode)
                throw new InvalidOperationException("Já existe outra unidade cadastrada com este código nesta empresa.");
        }

        unit.Name = name;
        unit.Code = code;
        unit.City = string.IsNullOrWhiteSpace(request.City) ? null : request.City.Trim();
        unit.State = string.IsNullOrWhiteSpace(request.State) ? null : request.State.Trim().ToUpper();
        unit.IsActive = request.IsActive;
        unit.UpdatedAt = DateTime.UtcNow;

        _unitRepository.Update(unit);
        await _unitRepository.SaveChangesAsync();

        return MapToResponse(unit);
    }

    public async Task DeleteAsync(Guid id)
    {
        var unit = await _unitRepository.GetByIdAsync(id);

        if (unit is null)
            throw new KeyNotFoundException("Unidade não encontrada.");

        await ValidateCompanyAccessAsync(unit.CompanyId, writeOperation: true);

        unit.IsActive = false;
        unit.UpdatedAt = DateTime.UtcNow;

        _unitRepository.Update(unit);
        await _unitRepository.SaveChangesAsync();
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

    private async Task ValidateCompanyAccessAsync(Guid companyId, bool writeOperation = false)
    {
        var user = await GetActiveCurrentUserAsync();
        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            return;

        if (!user.CompanyId.HasValue || user.CompanyId.Value != companyId)
            throw new UnauthorizedAccessException("Você não tem permissão para acessar unidades de outra empresa.");

        if (writeOperation && !await _userManager.IsInRoleAsync(user, SystemRoles.CompanyAdmin))
            throw new UnauthorizedAccessException("Apenas administradores podem cadastrar ou alterar unidades.");
    }

    private static UnitResponse MapToResponse(Unit unit)
    {
        return new UnitResponse
        {
            Id = unit.Id,
            CompanyId = unit.CompanyId,
            CompanyName = unit.Company?.Name ?? string.Empty,
            Name = unit.Name,
            Code = unit.Code,
            City = unit.City,
            State = unit.State,
            IsActive = unit.IsActive,
            CreatedAt = unit.CreatedAt,
            UpdatedAt = unit.UpdatedAt
        };
    }
}