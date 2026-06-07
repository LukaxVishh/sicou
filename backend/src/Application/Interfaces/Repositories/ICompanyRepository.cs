using Sicou.Domain.Entities;

namespace Sicou.Application.Interfaces.Repositories;

public interface ICompanyRepository
{
    Task<Company?> GetByIdAsync(Guid id);

    Task<IReadOnlyList<Company>> GetAllAsync();

    Task<bool> ExistsByNameAsync(string name, Guid? ignoreId = null);

    Task AddAsync(Company company);

    void Update(Company company);

    void Delete(Company company);

    Task SaveChangesAsync();
}