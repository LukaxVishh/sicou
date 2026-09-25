using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class ProcessNodeRepository : IProcessNodeRepository
{
    private readonly ApplicationDbContext _context;

    public ProcessNodeRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProcessNode?> GetByIdAsync(Guid id)
    {
        return await _context.ProcessNodes
            .Include(x => x.Area)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IReadOnlyList<ProcessNode>> GetByAreaIdAsync(Guid areaId)
    {
        return await _context.ProcessNodes
            .Where(x => x.AreaId == areaId)
            .OrderBy(x => x.Name)
            .ToListAsync();
    }

    public async Task<bool> ExistsByCodeAsync(Guid areaId, string code, Guid? ignoreId = null)
    {
        var query = _context.ProcessNodes.Where(x => x.AreaId == areaId && x.Code == code);
        if (ignoreId.HasValue)
            query = query.Where(x => x.Id != ignoreId.Value);

        return await query.AnyAsync();
    }

    public async Task AddAsync(ProcessNode node)
    {
        await _context.ProcessNodes.AddAsync(node);
    }

    public void Update(ProcessNode node)
    {
        _context.ProcessNodes.Update(node);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
