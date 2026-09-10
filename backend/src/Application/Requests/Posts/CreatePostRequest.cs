namespace Sicou.Application.Requests.Posts;

public class CreatePostRequest
{
    public Guid? CompanyId { get; set; }

    public bool PublishToAllCompanies { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
}
