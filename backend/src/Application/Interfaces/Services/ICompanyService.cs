using Sicou.Application.Requests.Companies;
using Sicou.Application.Responses.Companies;

namespace Sicou.Application.Interfaces.Services;

public interface ICompanyService
{
    Task<CompanyResponse> CreateAsync(CreateCompanyRequest request);

    Task<IReadOnlyList<CompanyResponse>> GetAllAsync();

    Task<CompanyResponse> GetByIdAsync(Guid id);

    Task<CompanyResponse> UpdateAsync(Guid id, UpdateCompanyRequest request);

    Task DeleteAsync(Guid id);
}