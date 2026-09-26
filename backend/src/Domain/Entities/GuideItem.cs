using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class GuideItem : BaseEntity
{
    public Guid AreaId { get; set; }
    public Guid CategoryId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Url { get; set; }
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; }
    public string? FileName { get; set; }
    public byte[]? FileData { get; set; }
}
