namespace Sicou.Application.Requests.Posts;

public class UpdatePostRequest
{
    public string Title { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public bool RemoveImage { get; set; }
}
