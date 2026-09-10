using Sicou.Domain.Common;

namespace Sicou.Domain.Entities;

public class Post : BaseEntity
{
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }

    public string AuthorId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public bool IsPinned { get; set; }
}
