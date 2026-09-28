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
    private readonly IAreaRepository _areaRepository;
    private readonly IUserAreaAccessRepository _userAreaAccessRepository;

    public PostService(
        IPostRepository postRepository,
        IPostMediaStorage mediaStorage,
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        ICompanyRepository companyRepository,
        IAreaRepository areaRepository,
        IUserAreaAccessRepository userAreaAccessRepository)
    {
        _postRepository = postRepository;
        _mediaStorage = mediaStorage;
        _currentUser = currentUser;
        _userManager = userManager;
        _companyRepository = companyRepository;
        _areaRepository = areaRepository;
        _userAreaAccessRepository = userAreaAccessRepository;
    }

    public async Task<PagedPostsResponse> GetPageAsync(Guid? companyId, Guid? areaId, int page, int pageSize)
    {
        var user = await GetActiveCurrentUserAsync();
        var targetCompanyId = await ResolveCompanyForListingAsync(user, companyId);
        var normalizedPage = Math.Max(page, 1);
        var normalizedPageSize = Math.Clamp(pageSize, 1, 50);
        var posts = await _postRepository.GetPageAsync(targetCompanyId, areaId, normalizedPage, normalizedPageSize);
        var totalCount = await _postRepository.CountAsync(targetCompanyId, areaId);
        var responses = new List<PostResponse>();
        foreach (var post in posts)
            responses.Add(await MapToResponseAsync(post));

        return new PagedPostsResponse { Items = responses, Page = normalizedPage, PageSize = normalizedPageSize, TotalCount = totalCount };
    }

    public async Task<PostResponse> CreateAsync(CreatePostRequest request, PostImageUpload? image)
    {
        var user = await GetActiveCurrentUserAsync();
        var companyId = await ResolveCompanyForCreationAsync(user, request.CompanyId, request.PublishToAllCompanies);

        Area? targetArea = null;
        if (request.AreaId.HasValue)
        {
            targetArea = await _areaRepository.GetByIdAsync(request.AreaId.Value);
            if (targetArea is null || !targetArea.IsActive)
                throw new KeyNotFoundException("Área da sede não encontrada ou inativa.");

            if (companyId.HasValue && targetArea.CompanyId != companyId.Value)
                throw new InvalidOperationException("A área selecionada não pertence à empresa informada.");

            if (!await CanPublishInAreaAsync(user, companyId, request.AreaId.Value))
                throw new UnauthorizedAccessException("Você não possui permissão para publicar informativos nesta área da sede.");
        }
        else
        {
            if (!await CanPublishGeneralPostAsync(user, companyId))
                throw new UnauthorizedAccessException("Apenas administradores podem publicar comunicados institucionais gerais sem área vinculada.");
        }

        var (title, content) = NormalizeContent(request.Title, request.Content);
        var imageUrl = image is null ? null : await _mediaStorage.SaveAsync(image);
        var post = new Post
        {
            CompanyId = companyId,
            AreaId = request.AreaId,
            AuthorId = user.Id.ToString(),
            Title = title,
            Content = content,
            ImageUrl = imageUrl,
            IsPinned = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _postRepository.AddAsync(post);
        await _postRepository.SaveChangesAsync();

        if (companyId.HasValue)
            post.Company = await GetActiveCompanyAsync(companyId.Value);
        if (request.AreaId.HasValue)
            post.Area = targetArea;

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

    private async Task<bool> CanPublishInAreaAsync(ApplicationUser user, Guid? companyId, Guid areaId)
    {
        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            return true;

        if (await _userManager.IsInRoleAsync(user, SystemRoles.CompanyAdmin))
            return !companyId.HasValue || user.CompanyId == companyId;

        var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
        return accesses.Any(a => a.IsActive && a.AreaId == areaId && (a.CanPublishInformatives || a.CanManage));
    }

    private async Task<bool> CanPublishGeneralPostAsync(ApplicationUser user, Guid? companyId)
    {
        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            return true;

        if (await _userManager.IsInRoleAsync(user, SystemRoles.CompanyAdmin))
            return !companyId.HasValue || user.CompanyId == companyId;

        return false;
    }

    private async Task<bool> CanManagePostAsync(ApplicationUser user, Post post)
    {
        if (user.Id.ToString() == post.AuthorId)
            return true;

        return await CanModeratePostAsync(user, post);
    }

    private async Task<bool> CanModeratePostAsync(ApplicationUser user, Post post)
    {
        if (await _userManager.IsInRoleAsync(user, SystemRoles.SuperAdmin))
            return true;

        if (post.CompanyId.HasValue && await _userManager.IsInRoleAsync(user, SystemRoles.CompanyAdmin) && user.CompanyId == post.CompanyId)
            return true;

        if (post.AreaId.HasValue)
        {
            var accesses = await _userAreaAccessRepository.GetByUserIdAsync(user.Id.ToString());
            return accesses.Any(a => a.IsActive && a.AreaId == post.AreaId.Value && a.CanManage);
        }

        return false;
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
        string? authorAreaName = post.Area?.Name;
        if (string.IsNullOrEmpty(authorAreaName) && author != null)
        {
            var accesses = await _userAreaAccessRepository.GetByUserIdAsync(author.Id.ToString());
            var activeAccess = accesses.FirstOrDefault(a => a.IsActive && a.CanPublishInformatives) 
                               ?? accesses.FirstOrDefault(a => a.IsActive);
            authorAreaName = activeAccess?.Area?.Name;
        }

        return new PostResponse
        {
            Id = post.Id,
            CompanyId = post.CompanyId,
            CompanyName = post.Company?.Name ?? "Todas as empresas",
            AreaId = post.AreaId,
            AreaName = post.Area?.Name ?? authorAreaName,
            IsGlobal = !post.CompanyId.HasValue,
            AuthorId = post.AuthorId,
            AuthorName = author?.FullName ?? "Usuário removido",
            AuthorAreaName = authorAreaName,
            Title = post.Title,
            Content = post.Content,
            ImageUrl = post.ImageUrl,
            IsPinned = post.IsPinned,
            CreatedAt = post.CreatedAt,
            UpdatedAt = post.UpdatedAt
        };
    }
}
