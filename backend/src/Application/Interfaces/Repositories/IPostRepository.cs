using Sicou.Domain.Entities;

namespace Sicou.Application.Interfaces.Repositories;

public interface IPostRepository
{
    Task<Post?> GetByIdAsync(Guid id);

    Task<IReadOnlyList<Post>> GetPageAsync(Guid? companyId, Guid? areaId, int page, int pageSize);

    Task<int> CountAsync(Guid? companyId, Guid? areaId);

    Task AddAsync(Post post);

    void Update(Post post);

    Task SaveChangesAsync();
}
