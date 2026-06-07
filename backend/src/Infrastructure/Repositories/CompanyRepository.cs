using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class CompanyRepository : ICompanyRepository
{
    private readonly ApplicationDbContext _context;

    public CompanyRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Company?> GetByIdAsync(Guid id)
    {
        return await _context.Companies
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IReadOnlyList<Company>> GetAllAsync()
    {
        return await _context.Companies
            .OrderBy(x => x.Name)
            .ToListAsync();
    }

    public async Task<bool> ExistsByNameAsync(string name, Guid? ignoreId = null)
    {
        var normalizedName = name.Trim().ToLower();

        return await _context.Companies
            .AnyAsync(x =>
                x.Name.ToLower() == normalizedName &&
                (!ignoreId.HasValue || x.Id != ignoreId.Value));
    }

    public async Task AddAsync(Company company)
    {
        await _context.Companies.AddAsync(company);
    }

    public void Update(Company company)
    {
        _context.Companies.Update(company);
    }

    public void Delete(Company company)
    {
        _context.Companies.Remove(company);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}