using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Areas;
using Sicou.Application.Responses.Areas;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class AreaService : IAreaService
{
    private readonly IAreaRepository _areaRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly UserManager<ApplicationUser> _userManager;

    public AreaService(
        IAreaRepository areaRepository,
        ICompanyRepository companyRepository,
        ICurrentUserService currentUserService,
        UserManager<ApplicationUser> userManager)
    {
        _areaRepository = areaRepository;
        _companyRepository = companyRepository;
        _currentUserService = currentUserService;
        _userManager = userManager;
    }

    public async Task<AreaResponse> CreateAsync(Guid companyId, CreateAreaRequest request)
    {
        await ValidateCompanyAccessAsync(companyId, writeOperation: true);

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
        await ValidateCompanyAccessAsync(companyId, writeOperation: false);

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

        await ValidateCompanyAccessAsync(area.CompanyId, writeOperation: false);

        return MapToResponse(area);
    }

    public async Task<AreaResponse> UpdateAsync(Guid id, UpdateAreaRequest request)
    {
        var area = await _areaRepository.GetByIdWithModulesAsync(id);

        if (area is null)
            throw new KeyNotFoundException("Área não encontrada.");

        await ValidateCompanyAccessAsync(area.CompanyId, writeOperation: true);

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

        await ValidateCompanyAccessAsync(area.CompanyId, writeOperation: true);

        var requestedModuleCodes = request.ModuleCodes
            .Distinct()
            .ToList();

        var modules = await _areaRepository.GetModulesByCodesAsync(requestedModuleCodes);

        if (requestedModuleCodes.Any() && modules.Count != requestedModuleCodes.Count)
            throw new InvalidOperationException("Um ou mais módulos informados são inválidos.");

        var existingAreaModules = area.AreaModules.ToList();

        if (existingAreaModules.Count > 0)
        {
            _areaRepository.RemoveAreaModules(existingAreaModules);
            area.AreaModules.Clear();
        }

        var newAreaModules = modules
            .Select(module => new AreaModule
            {
                Id = Guid.NewGuid(),
                AreaId = area.Id,
                ModuleId = module.Id,
                Module = module,
                Enabled = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (newAreaModules.Count > 0)
        {
            _areaRepository.AddAreaModules(newAreaModules);

            foreach (var areaModule in newAreaModules)
            {
                area.AreaModules.Add(areaModule);
            }
        }

        area.UpdatedAt = DateTime.UtcNow;

        await _areaRepository.SaveChangesAsync();

        return MapToResponse(area);
    }
    
    public async Task DeleteAsync(Guid id)
    {
        var area = await _areaRepository.GetByIdWithModulesAsync(id);

        if (area is null)
            throw new KeyNotFoundException("Área não encontrada.");

        await ValidateCompanyAccessAsync(area.CompanyId, writeOperation: true);

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
            throw new UnauthorizedAccessException("Você não tem permissão para acessar áreas de outra empresa.");

        if (writeOperation && !await _userManager.IsInRoleAsync(user, SystemRoles.CompanyAdmin))
            throw new UnauthorizedAccessException("Apenas administradores podem cadastrar ou alterar áreas.");
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
                .Where(x => x.IsActive && x.Enabled)
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