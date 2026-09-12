using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Companies;
using Sicou.Application.Responses.Companies;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class CompanyService : ICompanyService
{
    private readonly ICompanyRepository _companyRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly UserManager<ApplicationUser> _userManager;

    public CompanyService(
        ICompanyRepository companyRepository,
        ICurrentUserService currentUserService,
        UserManager<ApplicationUser> userManager)
    {
        _companyRepository = companyRepository;
        _currentUserService = currentUserService;
        _userManager = userManager;
    }

    public async Task<CompanyResponse> CreateAsync(CreateCompanyRequest request)
    {
        var user = await GetActiveCurrentUserAsync();
        if (!await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            throw new UnauthorizedAccessException("Apenas Super Administradores podem cadastrar empresas.");

        var name = request.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("O nome da empresa é obrigatório.");

        var exists = await _companyRepository.ExistsByNameAsync(name);

        if (exists)
            throw new InvalidOperationException("Já existe uma empresa cadastrada com este nome.");

        var company = new Company
        {
            Id = Guid.NewGuid(),
            Name = name,
            Document = string.IsNullOrWhiteSpace(request.Document)
                ? null
                : request.Document.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _companyRepository.AddAsync(company);
        await _companyRepository.SaveChangesAsync();

        return MapToResponse(company);
    }

    public async Task<IReadOnlyList<CompanyResponse>> GetAllAsync()
    {
        var user = await GetActiveCurrentUserAsync();
        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
        {
            var companies = await _companyRepository.GetAllAsync();
            return companies
                .Select(MapToResponse)
                .ToList();
        }

        if (!user.CompanyId.HasValue)
            return Array.Empty<CompanyResponse>();

        var userCompany = await _companyRepository.GetByIdAsync(user.CompanyId.Value);
        if (userCompany is null || !userCompany.IsActive)
            return Array.Empty<CompanyResponse>();

        return new List<CompanyResponse> { MapToResponse(userCompany) };
    }

    public async Task<CompanyResponse> GetByIdAsync(Guid id)
    {
        var user = await GetActiveCurrentUserAsync();
        if (!await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
        {
            if (!user.CompanyId.HasValue || user.CompanyId.Value != id)
                throw new UnauthorizedAccessException("Você não tem permissão para visualizar dados de outra empresa.");
        }

        var company = await _companyRepository.GetByIdAsync(id);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        return MapToResponse(company);
    }

    public async Task<CompanyResponse> UpdateAsync(Guid id, UpdateCompanyRequest request)
    {
        var user = await GetActiveCurrentUserAsync();
        if (!await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            throw new UnauthorizedAccessException("Apenas Super Administradores podem alterar dados cadastrais de empresas.");

        var company = await _companyRepository.GetByIdAsync(id);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        var name = request.Name.Trim();

        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("O nome da empresa é obrigatório.");

        var exists = await _companyRepository.ExistsByNameAsync(name, id);

        if (exists)
            throw new InvalidOperationException("Já existe outra empresa cadastrada com este nome.");

        company.Name = name;
        company.Document = string.IsNullOrWhiteSpace(request.Document)
            ? null
            : request.Document.Trim();
        company.IsActive = request.IsActive;
        company.UpdatedAt = DateTime.UtcNow;

        _companyRepository.Update(company);
        await _companyRepository.SaveChangesAsync();

        return MapToResponse(company);
    }

    public async Task DeleteAsync(Guid id)
    {
        var user = await GetActiveCurrentUserAsync();
        if (!await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            throw new UnauthorizedAccessException("Apenas Super Administradores podem inativar empresas.");

        var company = await _companyRepository.GetByIdAsync(id);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        company.IsActive = false;
        company.UpdatedAt = DateTime.UtcNow;

        _companyRepository.Update(company);
        await _companyRepository.SaveChangesAsync();
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

    private static CompanyResponse MapToResponse(Company company)
    {
        return new CompanyResponse
        {
            Id = company.Id,
            Name = company.Name,
            Document = company.Document,
            IsActive = company.IsActive,
            CreatedAt = company.CreatedAt,
            UpdatedAt = company.UpdatedAt
        };
    }
}