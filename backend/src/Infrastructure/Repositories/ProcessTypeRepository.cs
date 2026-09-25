using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class ProcessTypeRepository : IProcessTypeRepository
{
    private readonly ApplicationDbContext _context;

    public ProcessTypeRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProcessType?> GetByIdAsync(Guid id)
    {
        return await _context.ProcessTypes
            .Include(x => x.Area)
            .Include(x => x.StartNode)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<ProcessType?> GetCompleteTreeAsync(Guid id)
    {
        return await _context.ProcessTypes
            .Include(x => x.Area)
            .Include(x => x.StartNode)
            .Include(x => x.Nodes)
                .ThenInclude(n => n.ProcessNode)
            .Include(x => x.Fields)
                .ThenInclude(f => f.FieldDefinition)
            .Include(x => x.Fields)
                .ThenInclude(f => f.ProcessNode)
            .Include(x => x.Transitions)
                .ThenInclude(t => t.FromNode)
            .Include(x => x.Transitions)
                .ThenInclude(t => t.ToNode)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<IReadOnlyList<ProcessType>> GetByAreaIdAsync(Guid areaId)
    {
        return await _context.ProcessTypes
            .Include(x => x.Area)
            .Include(x => x.StartNode)
            .Include(x => x.Nodes)
            .Include(x => x.Fields)
            .Where(x => x.AreaId == areaId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ProcessType>> GetAvailableForAudienceAsync(Guid? companyId, ProcessAudience? userAudience)
    {
        // Somente árvores com Status == Homologated e compatíveis com a audiência do usuário
        var query = _context.ProcessTypes
            .Include(x => x.Area)
            .Include(x => x.StartNode)
            .Where(x => x.Status == ProcessTypeStatus.Homologated && x.IsActive);

        if (companyId.HasValue)
        {
            query = query.Where(x => x.Area.CompanyId == companyId.Value);
        }

        if (userAudience.HasValue)
        {
            if (userAudience == ProcessAudience.HeadquartersOnly)
            {
                query = query.Where(x => x.TargetAudience == ProcessAudience.All || x.TargetAudience == ProcessAudience.HeadquartersOnly);
            }
            else if (userAudience == ProcessAudience.UnitsOnly)
            {
                query = query.Where(x => x.TargetAudience == ProcessAudience.All || x.TargetAudience == ProcessAudience.UnitsOnly);
            }
        }

        return await query.OrderBy(x => x.Name).ToListAsync();
    }

    public async Task<ProcessType?> GetLatestHomologatedByFamilyIdAsync(Guid familyId)
    {
        return await _context.ProcessTypes
            .Where(x => x.FamilyId == familyId && x.Status == ProcessTypeStatus.Homologated)
            .OrderByDescending(x => x.VersionNumber)
            .FirstOrDefaultAsync();
    }

    public async Task<bool> ExistsByCodeAsync(Guid areaId, string code, Guid? ignoreId = null)
    {
        var query = _context.ProcessTypes.Where(x => x.AreaId == areaId && x.Code == code);
        if (ignoreId.HasValue)
            query = query.Where(x => x.Id != ignoreId.Value);

        return await query.AnyAsync();
    }

    public async Task AddAsync(ProcessType processType)
    {
        await _context.ProcessTypes.AddAsync(processType);
    }

    public void Update(ProcessType processType)
    {
        var entry = _context.Entry(processType);
        if (entry.State == EntityState.Detached)
        {
            _context.ProcessTypes.Update(processType);
        }
    }

    public void RemoveNodes(IEnumerable<ProcessTypeNode> nodes)
    {
        _context.ProcessTypeNodes.RemoveRange(nodes);
    }

    public void AddNodes(IEnumerable<ProcessTypeNode> nodes)
    {
        _context.ProcessTypeNodes.AddRange(nodes);
    }

    public void RemoveFields(IEnumerable<ProcessTypeField> fields)
    {
        _context.ProcessTypeFields.RemoveRange(fields);
    }

    public void AddFields(IEnumerable<ProcessTypeField> fields)
    {
        _context.ProcessTypeFields.AddRange(fields);
    }

    public void RemoveTransitions(IEnumerable<ProcessTransition> transitions)
    {
        _context.ProcessTransitions.RemoveRange(transitions);
    }

    public void AddTransitions(IEnumerable<ProcessTransition> transitions)
    {
        _context.ProcessTransitions.AddRange(transitions);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
