using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;

namespace Sicou.Infrastructure.Repositories;

public class PostRepository : IPostRepository
{
    private readonly ApplicationDbContext _context;

    public PostRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Post?> GetByIdAsync(Guid id)
    {
        return await _context.Posts
            .Include(x => x.Company)
            .FirstOrDefaultAsync(x => x.Id == id && x.IsActive);
    }

    public async Task<IReadOnlyList<Post>> GetPageAsync(Guid? companyId, int page, int pageSize)
    {
        var query = _context.Posts
            .AsNoTracking()
            .Include(x => x.Company)
            .Where(x => x.IsActive);

        if (companyId.HasValue)
            query = query.Where(x => x.CompanyId == companyId.Value || x.CompanyId == null);

        return await query
            .OrderByDescending(x => x.IsPinned)
            .ThenByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public Task<int> CountAsync(Guid? companyId)
    {
        var query = _context.Posts.AsNoTracking().Where(x => x.IsActive);

        if (companyId.HasValue)
            query = query.Where(x => x.CompanyId == companyId.Value || x.CompanyId == null);

        return query.CountAsync();
    }

    public async Task AddAsync(Post post)
    {
        await _context.Posts.AddAsync(post);
    }

    public void Update(Post post)
    {
        _context.Posts.Update(post);
    }

    public Task SaveChangesAsync()
    {
        return _context.SaveChangesAsync();
    }
}
