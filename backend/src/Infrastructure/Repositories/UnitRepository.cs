using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class UnitRepository : IUnitRepository
{
    private readonly ApplicationDbContext _context;

    public UnitRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Unit?> GetByIdAsync(Guid id)
    {
        return await _context.Units
            .Include(x => x.Company)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IReadOnlyList<Unit>> GetByCompanyIdAsync(Guid companyId)
    {
        return await _context.Units
            .Include(x => x.Company)
            .Where(x => x.CompanyId == companyId && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync();
    }

    public async Task<bool> ExistsByNameAsync(Guid companyId, string name, Guid? ignoreId = null)
    {
        var normalizedName = name.Trim().ToLower();

        return await _context.Units
            .AnyAsync(x =>
                x.CompanyId == companyId &&
                x.Name.ToLower() == normalizedName &&
                (!ignoreId.HasValue || x.Id != ignoreId.Value));
    }

    public async Task<bool> ExistsByCodeAsync(Guid companyId, string code, Guid? ignoreId = null)
    {
        var normalizedCode = code.Trim().ToLower();

        return await _context.Units
            .AnyAsync(x =>
                x.CompanyId == companyId &&
                x.Code != null &&
                x.Code.ToLower() == normalizedCode &&
                (!ignoreId.HasValue || x.Id != ignoreId.Value));
    }

    public async Task AddAsync(Unit unit)
    {
        await _context.Units.AddAsync(unit);
    }

    public void Update(Unit unit)
    {
        _context.Units.Update(unit);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}