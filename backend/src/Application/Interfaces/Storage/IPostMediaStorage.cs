using Sicou.Application.Requests.Posts;

namespace Sicou.Application.Interfaces.Storage;

public interface IPostMediaStorage
{
    Task<string> SaveAsync(PostImageUpload image);

    Task DeleteAsync(string? imageUrl);
}
