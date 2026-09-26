using System.ComponentModel.DataAnnotations;

namespace Sicou.Application.Requests.Guide;

public class GuideCategoryRequest
{
    [Required, StringLength(150)] public string Name { get; set; } = string.Empty;
    [Range(0, 100000)] public int SortOrder { get; set; }
}

public class GuideItemRequest
{
    public Guid CategoryId { get; set; }
    [Required, StringLength(200)] public string Title { get; set; } = string.Empty;
    [StringLength(50000)] public string Content { get; set; } = string.Empty;
    [StringLength(2048)] public string? Url { get; set; }
    [Range(0, 100000)] public int SortOrder { get; set; }
    public bool IsPublished { get; set; }
}
