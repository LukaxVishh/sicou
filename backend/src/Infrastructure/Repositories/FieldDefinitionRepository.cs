using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class FieldDefinitionRepository : IFieldDefinitionRepository
{
    private readonly ApplicationDbContext _context;

    public FieldDefinitionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<FieldDefinition?> GetByIdAsync(Guid id)
    {
        return await _context.FieldDefinitions
            .Include(x => x.Area)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IReadOnlyList<FieldDefinition>> GetByAreaIdAsync(Guid areaId)
    {
        return await _context.FieldDefinitions
            .Where(x => x.AreaId == areaId)
            .OrderBy(x => x.Name)
            .ToListAsync();
    }

    public async Task<bool> ExistsByCodeAsync(Guid areaId, string code, Guid? ignoreId = null)
    {
        var query = _context.FieldDefinitions.Where(x => x.AreaId == areaId && x.Code == code);
        if (ignoreId.HasValue)
            query = query.Where(x => x.Id != ignoreId.Value);

        return await query.AnyAsync();
    }

    public async Task AddAsync(FieldDefinition field)
    {
        await _context.FieldDefinitions.AddAsync(field);
    }

    public void Update(FieldDefinition field)
    {
        _context.FieldDefinitions.Update(field);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
