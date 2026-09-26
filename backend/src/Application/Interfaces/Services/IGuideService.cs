using Sicou.Application.Requests.Guide;
using Sicou.Application.Responses.Guide;

namespace Sicou.Application.Interfaces.Services;

public interface IGuideService
{
    Task<IReadOnlyList<GuideAreaResponse>> GetAreasAsync();
    Task<GuideResponse> GetAsync(Guid areaId);
    Task<GuideCategoryResponse> SaveCategoryAsync(Guid areaId, Guid? id, GuideCategoryRequest request);
    Task DeleteCategoryAsync(Guid areaId, Guid id);
    Task<GuideItemResponse> SaveItemAsync(Guid areaId, Guid? id, GuideItemRequest request);
    Task DeleteItemAsync(Guid areaId, Guid id);
    Task SaveFileAsync(Guid areaId, Guid id, string name, byte[] data);
    Task<GuideFileResponse> GetFileAsync(Guid areaId, Guid id);
    Task DeleteFileAsync(Guid areaId, Guid id);
}
