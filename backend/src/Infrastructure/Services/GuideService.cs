using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Guide;
using Sicou.Application.Responses.Guide;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class GuideService(ApplicationDbContext db, ICurrentUserService currentUser,
    IPermissionService permissions, UserManager<ApplicationUser> users) : IGuideService
{
    public async Task<IReadOnlyList<GuideAreaResponse>> GetAreasAsync()
    {
        var user = await users.FindByIdAsync(currentUser.UserId ?? string.Empty);
        if (user is null || !user.IsActive) throw new UnauthorizedAccessException();
        var super = await users.IsInRoleAsync(user, SystemRoles.SuperAdmin);
        var admin = await users.IsInRoleAsync(user, SystemRoles.CompanyAdmin);
        var userId = user.Id.ToString();
        return await db.Areas.AsNoTracking()
            .Where(a => a.IsActive && a.Company.IsActive && (super || a.CompanyId == user.CompanyId))
            .Where(a => a.AreaModules.Any(m => m.IsActive && m.Enabled && m.Module.Code == ModuleCode.Guide))
            .Where(a => super || admin || db.UserAreaAccesses.Any(p => p.AreaId == a.Id && p.UserId == userId && p.IsActive && (p.CanView || p.CanManageGuide)))
            .OrderBy(a => a.Company.Name).ThenBy(a => a.Name)
            .Select(a => new GuideAreaResponse(a.Id, a.Name, a.CompanyId, a.Company.Name)).ToListAsync();
    }
    private async Task<bool> AuthorizeAsync(Guid areaId, bool write = false)
    {
        var user = await users.FindByIdAsync(currentUser.UserId ?? string.Empty);
        if (user is null || !user.IsActive) throw new UnauthorizedAccessException();
        var area = await db.Areas.AsNoTracking().FirstOrDefaultAsync(a => a.Id == areaId && a.IsActive && a.Company.IsActive)
            ?? throw new KeyNotFoundException("Área não encontrada.");
        if (!await users.IsInRoleAsync(user, SystemRoles.SuperAdmin) && user.CompanyId != area.CompanyId)
            throw new UnauthorizedAccessException("Área de outra empresa.");
        var manage = await permissions.CanManageGuideAsync(user.Id.ToString(), areaId);
        if (write ? !manage : !manage && !await permissions.CanViewAreaAsync(user.Id.ToString(), areaId))
            throw new UnauthorizedAccessException("Sem permissão para acessar o Orientador.");
        if (!await db.AreaModules.AnyAsync(m => m.AreaId == areaId && m.IsActive && m.Enabled && m.Module.Code == ModuleCode.Guide))
            throw new InvalidOperationException("O módulo Orientador está desabilitado nesta área.");
        return manage;
    }

    public async Task<GuideResponse> GetAsync(Guid areaId)
    {
        var manage = await AuthorizeAsync(areaId);
        var categories = await db.Set<GuideCategory>().AsNoTracking().Where(c => c.AreaId == areaId)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new GuideCategoryResponse(c.Id, c.Name, c.SortOrder)).ToListAsync();
        var items = await db.Set<GuideItem>().AsNoTracking().Where(i => i.AreaId == areaId && (manage || i.IsPublished))
            .OrderBy(i => i.SortOrder).ThenBy(i => i.Title)
            .Select(i => new GuideItemResponse(i.Id, i.CategoryId, i.Title, i.Content, i.Url, i.SortOrder,
                i.IsPublished, i.FileName, i.CreatedAt, i.UpdatedAt)).ToListAsync();
        return new(manage, categories, items);
    }

    public async Task<GuideCategoryResponse> SaveCategoryAsync(Guid areaId, Guid? id, GuideCategoryRequest request)
    {
        await AuthorizeAsync(areaId, true);
        var name = request.Name.Trim();
        if (name.Length == 0) throw new ArgumentException("Informe o nome da categoria.");
        var category = id.HasValue ? await CategoryAsync(areaId, id.Value) : new GuideCategory { AreaId = areaId };
        category.Name = name;
        category.SortOrder = request.SortOrder;
        category.UpdatedAt = DateTime.UtcNow;
        if (!id.HasValue) db.Add(category);
        await db.SaveChangesAsync();
        return new(category.Id, category.Name, category.SortOrder);
    }

    private async Task<GuideCategory> CategoryAsync(Guid areaId, Guid id) =>
        await db.Set<GuideCategory>().FirstOrDefaultAsync(c => c.Id == id && c.AreaId == areaId)
        ?? throw new KeyNotFoundException("Categoria não encontrada nesta área.");

    public async Task DeleteCategoryAsync(Guid areaId, Guid id)
    {
        await AuthorizeAsync(areaId, true);
        var category = await CategoryAsync(areaId, id);
        if (await db.Set<GuideItem>().AnyAsync(i => i.CategoryId == id))
            throw new InvalidOperationException("Remova ou mova os itens antes de excluir a categoria.");
        db.Remove(category);
        await db.SaveChangesAsync();
    }

    private async Task<GuideItem> ItemAsync(Guid areaId, Guid id) =>
        await db.Set<GuideItem>().FirstOrDefaultAsync(i => i.Id == id && i.AreaId == areaId)
        ?? throw new KeyNotFoundException("Orientação não encontrada nesta área.");

    public async Task<GuideItemResponse> SaveItemAsync(Guid areaId, Guid? id, GuideItemRequest request)
    {
        await AuthorizeAsync(areaId, true);
        await CategoryAsync(areaId, request.CategoryId);
        if (string.IsNullOrWhiteSpace(request.Title)) throw new ArgumentException("Informe o título.");
        var url = string.IsNullOrWhiteSpace(request.Url) ? null : request.Url.Trim();
        if (url != null && (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)))
            throw new ArgumentException("O link deve ser uma URL HTTP ou HTTPS.");
        var item = id.HasValue ? await ItemAsync(areaId, id.Value) : new GuideItem { AreaId = areaId };
        item.CategoryId = request.CategoryId;
        item.Title = request.Title.Trim();
        item.Content = request.Content?.Trim() ?? string.Empty;
        item.Url = url;
        item.SortOrder = request.SortOrder;
        item.IsPublished = request.IsPublished;
        item.UpdatedAt = DateTime.UtcNow;
        if (!id.HasValue) db.Add(item);
        await db.SaveChangesAsync();
        return new(item.Id, item.CategoryId, item.Title, item.Content, item.Url, item.SortOrder,
            item.IsPublished, item.FileName, item.CreatedAt, item.UpdatedAt);
    }

    public async Task DeleteItemAsync(Guid areaId, Guid id)
    {
        await AuthorizeAsync(areaId, true);
        db.Remove(await ItemAsync(areaId, id));
        await db.SaveChangesAsync();
    }

    public async Task SaveFileAsync(Guid areaId, Guid id, string name, byte[] data)
    {
        await AuthorizeAsync(areaId, true);
        if (data.Length == 0 || data.Length > 10 * 1024 * 1024) throw new ArgumentException("O arquivo deve ter entre 1 byte e 10 MB.");
        var item = await ItemAsync(areaId, id);
        item.FileName = Path.GetFileName(name.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(item.FileName) || item.FileName.Length > 255) throw new ArgumentException("Nome de arquivo inválido.");
        item.FileData = data;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task<GuideFileResponse> GetFileAsync(Guid areaId, Guid id)
    {
        var manage = await AuthorizeAsync(areaId);
        var item = await ItemAsync(areaId, id);
        if ((!manage && !item.IsPublished) || item.FileData == null) throw new KeyNotFoundException("Arquivo não encontrado.");
        return new(item.FileName!, item.FileData);
    }

    public async Task DeleteFileAsync(Guid areaId, Guid id)
    {
        await AuthorizeAsync(areaId, true);
        var item = await ItemAsync(areaId, id);
        item.FileName = null;
        item.FileData = null;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }
}
