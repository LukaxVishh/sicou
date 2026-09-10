using Microsoft.AspNetCore.Hosting;
using Sicou.Application.Interfaces.Storage;
using Sicou.Application.Requests.Posts;

namespace Sicou.Infrastructure.Storage;

public class LocalPostMediaStorage : IPostMediaStorage
{
    private static readonly IReadOnlyDictionary<string, string> AllowedExtensions =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp"
        };

    private const long MaxFileSize = 5 * 1024 * 1024;
    private readonly string _postsDirectory;

    public LocalPostMediaStorage(IWebHostEnvironment environment)
    {
        _postsDirectory = Path.Combine(environment.ContentRootPath, "uploads", "posts");
    }

    public async Task<string> SaveAsync(PostImageUpload image)
    {
        if (image.Length <= 0 || image.Length > MaxFileSize)
            throw new InvalidOperationException("A imagem deve ter no máximo 5 MB.");

        if (!AllowedExtensions.TryGetValue(image.ContentType, out var extension))
            throw new InvalidOperationException("Envie uma imagem JPEG, PNG ou WebP.");

        Directory.CreateDirectory(_postsDirectory);

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(_postsDirectory, fileName);

        await using var input = image.Content;
        await using var output = File.Create(fullPath);
        await input.CopyToAsync(output);

        return $"/uploads/posts/{fileName}";
    }

    public Task DeleteAsync(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
            return Task.CompletedTask;

        var fileName = Path.GetFileName(imageUrl);
        var fullPath = Path.Combine(_postsDirectory, fileName);

        if (File.Exists(fullPath))
            File.Delete(fullPath);

        return Task.CompletedTask;
    }
}
