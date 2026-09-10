namespace Sicou.Application.Responses.Posts;

public class PostResponse
{
    public Guid Id { get; set; }

    public Guid? CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public bool IsGlobal { get; set; }

    public string AuthorId { get; set; } = string.Empty;

    public string AuthorName { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public bool IsPinned { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
