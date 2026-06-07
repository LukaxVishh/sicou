using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Units;
using Sicou.Application.Responses.Units;
using Sicou.Domain.Entities;

namespace Sicou.Infrastructure.Services;

public class UnitService : IUnitService
{
    private readonly IUnitRepository _unitRepository;
    private readonly ICompanyRepository _companyRepository;

    public UnitService(
        IUnitRepository unitRepository,
        ICompanyRepository companyRepository)
    {
        _unitRepository = unitRepository;
        _companyRepository = companyRepository;
    }

    public async Task<UnitResponse> CreateAsync(Guid companyId, CreateUnitRequest request)
    {
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

        return MapToResponse(unit);
    }

    public async Task<UnitResponse> UpdateAsync(Guid id, UpdateUnitRequest request)
    {
        var unit = await _unitRepository.GetByIdAsync(id);

        if (unit is null)
            throw new KeyNotFoundException("Unidade não encontrada.");

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

        unit.IsActive = false;
        unit.UpdatedAt = DateTime.UtcNow;

        _unitRepository.Update(unit);
        await _unitRepository.SaveChangesAsync();
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