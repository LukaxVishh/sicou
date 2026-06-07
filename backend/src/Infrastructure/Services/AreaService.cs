using System.Globalization;
using System.Text;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Areas;
using Sicou.Application.Responses.Areas;
using Sicou.Domain.Entities;

namespace Sicou.Infrastructure.Services;

public class AreaService : IAreaService
{
    private readonly IAreaRepository _areaRepository;
    private readonly ICompanyRepository _companyRepository;

    public AreaService(
        IAreaRepository areaRepository,
        ICompanyRepository companyRepository)
    {
        _areaRepository = areaRepository;
        _companyRepository = companyRepository;
    }

    public async Task<AreaResponse> CreateAsync(Guid companyId, CreateAreaRequest request)
    {
        var company = await _companyRepository.GetByIdAsync(companyId);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        if (!company.IsActive)
            throw new InvalidOperationException("Não é possível cadastrar área para uma empresa inativa.");

        var name = request.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("O nome da área é obrigatório.");

        var slug = GenerateSlug(name);

        var existsSlug = await _areaRepository.ExistsBySlugAsync(companyId, slug);

        if (existsSlug)
            throw new InvalidOperationException("Já existe uma área cadastrada com este nome nesta empresa.");

        var modules = await _areaRepository.GetModulesByCodesAsync(request.ModuleCodes);

        if (request.ModuleCodes.Any() && modules.Count != request.ModuleCodes.Distinct().Count())
            throw new InvalidOperationException("Um ou mais módulos informados são inválidos.");

        var area = new Area
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Name = name,
            Slug = slug,
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var module in modules)
        {
            area.AreaModules.Add(new AreaModule
            {
                Id = Guid.NewGuid(),
                AreaId = area.Id,
                ModuleId = module.Id,
                Module = module,
                Enabled = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _areaRepository.AddAsync(area);
        await _areaRepository.SaveChangesAsync();

        area.Company = company;

        return MapToResponse(area);
    }

    public async Task<IReadOnlyList<AreaResponse>> GetByCompanyIdAsync(Guid companyId)
    {
        var company = await _companyRepository.GetByIdAsync(companyId);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        var areas = await _areaRepository.GetByCompanyIdAsync(companyId);

        return areas
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<AreaResponse> GetByIdAsync(Guid id)
    {
        var area = await _areaRepository.GetByIdWithModulesAsync(id);

        if (area is null)
            throw new KeyNotFoundException("Área não encontrada.");

        return MapToResponse(area);
    }

    public async Task<AreaResponse> UpdateAsync(Guid id, UpdateAreaRequest request)
    {
        var area = await _areaRepository.GetByIdWithModulesAsync(id);

        if (area is null)
            throw new KeyNotFoundException("Área não encontrada.");

        var name = request.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("O nome da área é obrigatório.");

        var slug = GenerateSlug(name);

        var existsSlug = await _areaRepository.ExistsBySlugAsync(area.CompanyId, slug, id);

        if (existsSlug)
            throw new InvalidOperationException("Já existe outra área cadastrada com este nome nesta empresa.");

        area.Name = name;
        area.Slug = slug;
        area.Description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();
        area.IsActive = request.IsActive;
        area.UpdatedAt = DateTime.UtcNow;

        _areaRepository.Update(area);
        await _areaRepository.SaveChangesAsync();

        return MapToResponse(area);
    }

    public async Task<AreaResponse> UpdateModulesAsync(Guid id, UpdateAreaModulesRequest request)
    {
        var area = await _areaRepository.GetByIdWithModulesAsync(id);

        if (area is null)
            throw new KeyNotFoundException("Área não encontrada.");

        var modules = await _areaRepository.GetModulesByCodesAsync(request.ModuleCodes);

        if (request.ModuleCodes.Any() && modules.Count != request.ModuleCodes.Distinct().Count())
            throw new InvalidOperationException("Um ou mais módulos informados são inválidos.");

        _areaRepository.RemoveAreaModules(area.AreaModules);

        area.AreaModules.Clear();

        foreach (var module in modules)
        {
            area.AreaModules.Add(new AreaModule
            {
                Id = Guid.NewGuid(),
                AreaId = area.Id,
                ModuleId = module.Id,
                Module = module,
                Enabled = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        area.UpdatedAt = DateTime.UtcNow;

        _areaRepository.Update(area);
        await _areaRepository.SaveChangesAsync();

        return MapToResponse(area);
    }

    public async Task DeleteAsync(Guid id)
    {
        var area = await _areaRepository.GetByIdWithModulesAsync(id);

        if (area is null)
            throw new KeyNotFoundException("Área não encontrada.");

        area.IsActive = false;
        area.UpdatedAt = DateTime.UtcNow;

        foreach (var areaModule in area.AreaModules)
        {
            areaModule.Enabled = false;
            areaModule.IsActive = false;
            areaModule.UpdatedAt = DateTime.UtcNow;
        }

        _areaRepository.Update(area);
        await _areaRepository.SaveChangesAsync();
    }

    private static AreaResponse MapToResponse(Area area)
    {
        return new AreaResponse
        {
            Id = area.Id,
            CompanyId = area.CompanyId,
            CompanyName = area.Company?.Name ?? string.Empty,
            Name = area.Name,
            Slug = area.Slug,
            Description = area.Description,
            IsActive = area.IsActive,
            CreatedAt = area.CreatedAt,
            UpdatedAt = area.UpdatedAt,
            Modules = area.AreaModules
                .OrderBy(x => x.Module.Name)
                .Select(x => new AreaModuleResponse
                {
                    ModuleId = x.ModuleId,
                    Code = x.Module.Code,
                    Name = x.Module.Name,
                    Enabled = x.Enabled
                })
                .ToList()
        };
    }

    private static string GenerateSlug(string value)
    {
        var normalized = value
            .Trim()
            .ToLowerInvariant()
            .Normalize(NormalizationForm.FormD);

        var builder = new StringBuilder();

        foreach (var character in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);

            if (category == UnicodeCategory.NonSpacingMark)
                continue;

            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
                continue;
            }

            if (char.IsWhiteSpace(character) || character == '-' || character == '_')
            {
                builder.Append('-');
            }
        }

        var slug = builder.ToString();

        while (slug.Contains("--"))
            slug = slug.Replace("--", "-");

        return slug.Trim('-');
    }
}