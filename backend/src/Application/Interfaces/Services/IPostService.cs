using Sicou.Application.Requests.Posts;
using Sicou.Application.Responses.Posts;

namespace Sicou.Application.Interfaces.Services;

public interface IPostService
{
    Task<PagedPostsResponse> GetPageAsync(Guid? companyId, int page, int pageSize);

    Task<PostResponse> CreateAsync(CreatePostRequest request, PostImageUpload? image);

    Task<PostResponse> UpdateAsync(Guid id, UpdatePostRequest request, PostImageUpload? image);

    Task DeleteAsync(Guid id);

    Task<PostResponse> SetPinnedAsync(Guid id, bool isPinned);
}
