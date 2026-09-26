namespace Sicou.Application.Responses.Guide;

public record GuideCategoryResponse(Guid Id, string Name, int SortOrder);
public record GuideItemResponse(Guid Id, Guid CategoryId, string Title, string Content,
    string? Url, int SortOrder, bool IsPublished, string? FileName, DateTime CreatedAt, DateTime? UpdatedAt);
public record GuideResponse(bool CanManage, IReadOnlyList<GuideCategoryResponse> Categories,
    IReadOnlyList<GuideItemResponse> Items);
public record GuideFileResponse(string FileName, byte[] Data);

public record GuideAreaResponse(Guid Id, string Name, Guid CompanyId, string CompanyName);
