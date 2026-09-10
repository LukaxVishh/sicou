using Microsoft.AspNetCore.Identity;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Interfaces.Storage;
using Sicou.Application.Requests.Posts;
using Sicou.Application.Responses.Posts;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class PostService : IPostService
{
    private const int MaxTitleLength = 200;
    private const int MaxContentLength = 5_000;
    private readonly IPostRepository _postRepository;
    private readonly IPostMediaStorage _mediaStorage;
    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICompanyRepository _companyRepository;

    public PostService(IPostRepository postRepository, IPostMediaStorage mediaStorage, ICurrentUserService currentUser, UserManager<ApplicationUser> userManager, ICompanyRepository companyRepository)
    {
        _postRepository = postRepository;
        _mediaStorage = mediaStorage;
        _currentUser = currentUser;
        _userManager = userManager;
        _companyRepository = companyRepository;
    }

    public async Task<PagedPostsResponse> GetPageAsync(Guid? companyId, int page, int pageSize)
    {
        var user = await GetActiveCurrentUserAsync();
        var targetCompanyId = await ResolveCompanyForListingAsync(user, companyId);
        var normalizedPage = Math.Max(page, 1);
        var normalizedPageSize = Math.Clamp(pageSize, 1, 50);
        var posts = await _postRepository.GetPageAsync(targetCompanyId, normalizedPage, normalizedPageSize);
        var totalCount = await _postRepository.CountAsync(targetCompanyId);
        var responses = new List<PostResponse>();
        foreach (var post in posts)
            responses.Add(await MapToResponseAsync(post));

        return new PagedPostsResponse { Items = responses, Page = normalizedPage, PageSize = normalizedPageSize, TotalCount = totalCount };
    }

    public async Task<PostResponse> CreateAsync(CreatePostRequest request, PostImageUpload? image)
    {
        var user = await GetActiveCurrentUserAsync();
        var companyId = await ResolveCompanyForCreationAsync(user, request.CompanyId, request.PublishToAllCompanies);
        var (title, content) = NormalizeContent(request.Title, request.Content);
        var imageUrl = image is null ? null : await _mediaStorage.SaveAsync(image);
        var post = new Post { CompanyId = companyId, AuthorId = user.Id.ToString(), Title = title, Content = content, ImageUrl = imageUrl, IsPinned = false, IsActive = true, CreatedAt = DateTime.UtcNow };
        await _postRepository.AddAsync(post);
        await _postRepository.SaveChangesAsync();
        if (companyId.HasValue)
            post.Company = await GetActiveCompanyAsync(companyId.Value);
        return await MapToResponseAsync(post, user);
    }

    public async Task<PostResponse> UpdateAsync(Guid id, UpdatePostRequest request, PostImageUpload? image)
    {
        var user = await GetActiveCurrentUserAsync();
        var post = await GetPostAsync(id);
        if (!await CanManagePostAsync(user, post))
            throw new UnauthorizedAccessException("Você não tem permissão para editar esta publicação.");
        var (title, content) = NormalizeContent(request.Title, request.Content);
        var previousImageUrl = post.ImageUrl;
        if (image is not null)
            post.ImageUrl = await _mediaStorage.SaveAsync(image);
        else if (request.RemoveImage)
            post.ImageUrl = null;
        post.Title = title;
        post.Content = content;
        post.UpdatedAt = DateTime.UtcNow;
        _postRepository.Update(post);
        await _postRepository.SaveChangesAsync();
        if ((image is not null || request.RemoveImage) && previousImageUrl != post.ImageUrl)
            await _mediaStorage.DeleteAsync(previousImageUrl);
        return await MapToResponseAsync(post);
    }

    public async Task DeleteAsync(Guid id)
    {
        var user = await GetActiveCurrentUserAsync();
        var post = await GetPostAsync(id);
        if (!await CanManagePostAsync(user, post))
            throw new UnauthorizedAccessException("Você não tem permissão para excluir esta publicação.");
        post.IsActive = false;
        post.UpdatedAt = DateTime.UtcNow;
        _postRepository.Update(post);
        await _postRepository.SaveChangesAsync();
        await _mediaStorage.DeleteAsync(post.ImageUrl);
    }

    public async Task<PostResponse> SetPinnedAsync(Guid id, bool isPinned)
    {
        var user = await GetActiveCurrentUserAsync();
        var post = await GetPostAsync(id);
        if (!await CanModeratePostAsync(user, post))
            throw new UnauthorizedAccessException("Você não tem permissão para fixar esta publicação.");
        post.IsPinned = isPinned;
        post.UpdatedAt = DateTime.UtcNow;
        _postRepository.Update(post);
        await _postRepository.SaveChangesAsync();
        return await MapToResponseAsync(post);
    }

    private async Task<ApplicationUser> GetActiveCurrentUserAsync()
    {
        if (string.IsNullOrWhiteSpace(_currentUser.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");
        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null || !user.IsActive)
            throw new UnauthorizedAccessException("Usuário não está ativo.");
        return user;
    }

    private async Task<Guid?> ResolveCompanyForListingAsync(ApplicationUser user, Guid? requestedCompanyId)
    {
        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            return requestedCompanyId;
        if (!user.CompanyId.HasValue)
            throw new UnauthorizedAccessException("Seu usuário não está vinculado a uma empresa.");
        if (requestedCompanyId.HasValue && requestedCompanyId != user.CompanyId)
            throw new UnauthorizedAccessException("Você não pode acessar publicações de outra empresa.");
        return user.CompanyId;
    }

    private async Task<Guid?> ResolveCompanyForCreationAsync(ApplicationUser user, Guid? requestedCompanyId, bool publishToAllCompanies)
    {
        Guid companyId;
        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
        {
            if (publishToAllCompanies)
                return null;
            if (!requestedCompanyId.HasValue)
                throw new InvalidOperationException("Selecione a empresa ou publique para todas as empresas.");
            companyId = requestedCompanyId.Value;
        }
        else
        {
            if (!user.CompanyId.HasValue)
                throw new UnauthorizedAccessException("Seu usuário não está vinculado a uma empresa.");
            if (requestedCompanyId.HasValue && requestedCompanyId != user.CompanyId)
                throw new UnauthorizedAccessException("Você não pode publicar em outra empresa.");
            companyId = user.CompanyId.Value;
        }
        await GetActiveCompanyAsync(companyId);
        return companyId;
    }

    private async Task<Post> GetPostAsync(Guid id)
    {
        var post = await _postRepository.GetByIdAsync(id);
        return post ?? throw new KeyNotFoundException("Publicação não encontrada.");
    }

    private async Task<Company> GetActiveCompanyAsync(Guid companyId)
    {
        var company = await _companyRepository.GetByIdAsync(companyId);
        if (company is null || !company.IsActive)
            throw new KeyNotFoundException("Empresa não encontrada ou inativa.");
        return company;
    }

    private async Task<bool> CanManagePostAsync(ApplicationUser user, Post post)
    {
        return user.Id.ToString() == post.AuthorId || await CanModeratePostAsync(user, post);
    }

    private async Task<bool> CanModeratePostAsync(ApplicationUser user, Post post)
    {
        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            return true;
        return post.CompanyId.HasValue
            && await _userManager.IsInRoleAsync(user, SystemRoles.CompanyAdmin)
            && user.CompanyId == post.CompanyId;
    }

    private static (string Title, string Content) NormalizeContent(string title, string content)
    {
        var normalizedTitle = title?.Trim() ?? string.Empty;
        var normalizedContent = content?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedTitle))
            throw new InvalidOperationException("O título é obrigatório.");
        if (normalizedTitle.Length > MaxTitleLength)
            throw new InvalidOperationException($"O título deve ter no máximo {MaxTitleLength} caracteres.");
        if (string.IsNullOrWhiteSpace(normalizedContent))
            throw new InvalidOperationException("O conteúdo é obrigatório.");
        if (normalizedContent.Length > MaxContentLength)
            throw new InvalidOperationException($"O conteúdo deve ter no máximo {MaxContentLength} caracteres.");
        return (normalizedTitle, normalizedContent);
    }

    private async Task<PostResponse> MapToResponseAsync(Post post, ApplicationUser? knownAuthor = null)
    {
        var author = knownAuthor ?? await _userManager.FindByIdAsync(post.AuthorId);
        return new PostResponse
        {
            Id = post.Id, CompanyId = post.CompanyId,
            CompanyName = post.Company?.Name ?? "Todas as empresas",
            IsGlobal = !post.CompanyId.HasValue,
            AuthorId = post.AuthorId, AuthorName = author?.FullName ?? "Usuário removido",
            Title = post.Title, Content = post.Content, ImageUrl = post.ImageUrl,
            IsPinned = post.IsPinned, CreatedAt = post.CreatedAt, UpdatedAt = post.UpdatedAt
        };
    }
}
