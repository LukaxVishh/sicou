using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class AreaRepository : IAreaRepository
{
    private readonly ApplicationDbContext _context;

    public AreaRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Area?> GetByIdAsync(Guid id)
    {
        return await _context.Areas
            .Include(x => x.Company)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<Area?> GetByIdWithModulesAsync(Guid id)
    {
        return await _context.Areas
            .Include(x => x.Company)
            .Include(x => x.AreaModules)
                .ThenInclude(x => x.Module)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IReadOnlyList<Area>> GetByCompanyIdAsync(Guid companyId)
    {
        return await _context.Areas
            .Include(x => x.Company)
            .Include(x => x.AreaModules)
                .ThenInclude(x => x.Module)
            .Where(x => x.CompanyId == companyId && x.IsActive)
            .OrderBy(x => x.Name)
            .ToListAsync();
    }

    public async Task<bool> ExistsBySlugAsync(Guid companyId, string slug, Guid? ignoreId = null)
    {
        var normalizedSlug = slug.Trim().ToLower();

        return await _context.Areas
            .AnyAsync(x =>
                x.CompanyId == companyId &&
                x.Slug.ToLower() == normalizedSlug &&
                (!ignoreId.HasValue || x.Id != ignoreId.Value));
    }

    public async Task<List<Module>> GetModulesByCodesAsync(IEnumerable<ModuleCode> codes)
    {
        var codesList = codes
            .Distinct()
            .ToList();

        return await _context.Modules
            .Where(x => codesList.Contains(x.Code) && x.IsActive)
            .ToListAsync();
    }

    public async Task AddAsync(Area area)
    {
        await _context.Areas.AddAsync(area);
    }

    public void Update(Area area)
    {
        _context.Areas.Update(area);
    }

    public void RemoveAreaModules(IEnumerable<AreaModule> areaModules)
    {
        _context.AreaModules.RemoveRange(areaModules);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}