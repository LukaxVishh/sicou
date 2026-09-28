using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class ProcessInstanceRepository : IProcessInstanceRepository
{
    private readonly ApplicationDbContext _context;

    public ProcessInstanceRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProcessInstance?> GetByIdAsync(Guid id)
    {
        return await _context.ProcessInstances
            .Include(x => x.Company)
            .Include(x => x.Area)
            .Include(x => x.ProcessType)
            .Include(x => x.CurrentNode)
            .Include(x => x.OriginUnit)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<ProcessInstance?> GetCompleteInstanceAsync(Guid id)
    {
        return await _context.ProcessInstances
            .Include(x => x.Company)
            .Include(x => x.Area)
            .Include(x => x.ProcessType)
            .Include(x => x.CurrentNode)
            .Include(x => x.OriginUnit)
            .Include(x => x.FieldValues)
                .ThenInclude(fv => fv.FieldDefinition)
            .Include(x => x.History.OrderByDescending(h => h.CreatedAt))
                .ThenInclude(h => h.FromNode)
            .Include(x => x.History.OrderByDescending(h => h.CreatedAt))
                .ThenInclude(h => h.ToNode)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IReadOnlyList<ProcessInstance>> GetByAreaIdAsync(Guid areaId, ProcessStatus? status = null, Guid? originUnitId = null)
    {
        var query = _context.ProcessInstances
            .Include(x => x.ProcessType)
            .Include(x => x.CurrentNode)
            .Include(x => x.OriginUnit)
            .Where(x => x.AreaId == areaId);

        if (status.HasValue)
            query = query.Where(x => x.Status == status.Value);

        if (originUnitId.HasValue)
            query = query.Where(x => x.OriginUnitId == originUnitId.Value);

        return await query
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ProcessInstance>> GetByCompanyIdAsync(Guid companyId, ProcessStatus? status = null, Guid? originUnitId = null)
    {
        var query = _context.ProcessInstances
            .Include(x => x.Area)
            .Include(x => x.ProcessType)
            .Include(x => x.CurrentNode)
            .Include(x => x.OriginUnit)
            .Where(x => x.CompanyId == companyId);

        if (status.HasValue)
            query = query.Where(x => x.Status == status.Value);

        if (originUnitId.HasValue)
            query = query.Where(x => x.OriginUnitId == originUnitId.Value);

        return await query
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ProcessInstance>> GetByUserIdAsync(string userId)
    {
        return await _context.ProcessInstances
            .Include(x => x.Area)
            .Include(x => x.ProcessType)
            .Include(x => x.CurrentNode)
            .Include(x => x.OriginUnit)
            .Where(x => x.CreatedByUserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }

    public async Task<string> GenerateProcessNumberAsync(Guid companyId, Guid areaId)
    {
        var existingNumbers = await _context.ProcessInstances
            .Where(x => x.CompanyId == companyId)
            .Select(x => x.ProcessNumber)
            .ToListAsync();

        var maxNumber = 0;
        foreach (var numStr in existingNumbers)
        {
            if (int.TryParse(numStr.TrimStart('#'), out var parsed))
            {
                if (parsed > maxNumber)
                {
                    maxNumber = parsed;
                }
            }
        }

        var countTotal = existingNumbers.Count;
        var nextNumber = Math.Max(countTotal, maxNumber) + 1;

        return nextNumber.ToString();
    }

    public async Task AddAsync(ProcessInstance instance)
    {
        await _context.ProcessInstances.AddAsync(instance);
    }

    public void Update(ProcessInstance instance)
    {
        var entry = _context.Entry(instance);
        if (entry.State == EntityState.Detached)
        {
            _context.ProcessInstances.Update(instance);
        }
    }

    public void AddHistory(ProcessHistory history)
    {
        _context.ProcessHistories.Add(history);
    }

    public void AddFieldValue(ProcessFieldValue fieldValue)
    {
        _context.ProcessFieldValues.Add(fieldValue);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
