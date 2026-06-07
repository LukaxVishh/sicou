using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Companies;
using Sicou.Application.Responses.Companies;
using Sicou.Domain.Entities;

namespace Sicou.Infrastructure.Services;

public class CompanyService : ICompanyService
{
    private readonly ICompanyRepository _companyRepository;

    public CompanyService(ICompanyRepository companyRepository)
    {
        _companyRepository = companyRepository;
    }

    public async Task<CompanyResponse> CreateAsync(CreateCompanyRequest request)
    {
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
        var companies = await _companyRepository.GetAllAsync();

        return companies
            .Select(MapToResponse)
            .ToList();
    }

    public async Task<CompanyResponse> GetByIdAsync(Guid id)
    {
        var company = await _companyRepository.GetByIdAsync(id);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        return MapToResponse(company);
    }

    public async Task<CompanyResponse> UpdateAsync(Guid id, UpdateCompanyRequest request)
    {
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
        var company = await _companyRepository.GetByIdAsync(id);

        if (company is null)
            throw new KeyNotFoundException("Empresa não encontrada.");

        // Por enquanto faremos soft delete.
        company.IsActive = false;
        company.UpdatedAt = DateTime.UtcNow;

        _companyRepository.Update(company);
        await _companyRepository.SaveChangesAsync();
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