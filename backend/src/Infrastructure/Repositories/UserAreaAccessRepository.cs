using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class UserAreaAccessRepository : IUserAreaAccessRepository
{
    private readonly ApplicationDbContext _context;

    public UserAreaAccessRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<UserAreaAccess?> GetByIdAsync(Guid id)
    {
        return await _context.UserAreaAccesses
            .Include(x => x.Company)
            .Include(x => x.Unit)
            .Include(x => x.Area)
            .FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
    }

    public async Task<UserAreaAccess?> GetByUserCompanyUnitAreaAsync(
        string userId,
        Guid companyId,
        Guid? unitId,
        Guid areaId)
    {
        return await _context.UserAreaAccesses
            .FirstOrDefaultAsync(x =>
                x.UserId == userId &&
                x.CompanyId == companyId &&
                x.UnitId == unitId &&
                x.AreaId == areaId &&
                x.IsActive);
    }

    public async Task<List<UserAreaAccess>> GetByUserIdAsync(string userId)
    {
        return await _context.UserAreaAccesses
            .Include(x => x.Company)
            .Include(x => x.Unit)
            .Include(x => x.Area)
            .Where(x => x.UserId == userId && x.IsActive)
            .OrderBy(x => x.Company.Name)
            .ThenBy(x => x.Area.Name)
            .ToListAsync();
    }

    public async Task<List<UserAreaAccess>> GetByCompanyIdAsync(Guid companyId)
    {
        return await _context.UserAreaAccesses
            .Include(x => x.Company)
            .Include(x => x.Unit)
            .Include(x => x.Area)
            .Where(x => x.CompanyId == companyId && x.IsActive)
            .OrderBy(x => x.Area.Name)
            .ToListAsync();
    }

    public async Task AddAsync(UserAreaAccess access)
    {
        await _context.UserAreaAccesses.AddAsync(access);
    }

    public Task UpdateAsync(UserAreaAccess access)
    {
        _context.UserAreaAccesses.Update(access);
        return Task.CompletedTask;
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}