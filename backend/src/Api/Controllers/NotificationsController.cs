using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sicou.Infrastructure.Data;

namespace Sicou.Api.Controllers;

[ApiController, Authorize, Route("api/notifications")]
public class NotificationsController(ApplicationDbContext db) : ControllerBase
{
    private async Task<IQueryable<Sicou.Domain.Entities.UserNotification>> MineAsync()
    {
        var id = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == id && u.IsActive);
        return db.VisibleNotifications(user);
    }

    [HttpGet]
    public async Task<IActionResult> Get(int page = 1, int pageSize = 20)
    {
        Response.Headers.CacheControl = "no-store";
        var query = await MineAsync();
        page = Math.Clamp(page, 1, 100000);
        pageSize = Math.Clamp(pageSize, 1, 50);
        var totalCount = await query.CountAsync();
        var unreadCount = await query.CountAsync(n => n.ReadAt == null);
        var items = await query.AsNoTracking().OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(n => new { n.Id, n.Title, n.Url, n.AreaId, n.CreatedAt, n.ReadAt }).ToListAsync();
        return Ok(new { items, totalCount, unreadCount, page, pageSize });
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id)
    {
        var notification = await (await MineAsync()).FirstOrDefaultAsync(n => n.Id == id);
        if (notification == null) return NotFound();
        notification.ReadAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> ReadAll()
    {
        await (await MineAsync()).Where(n => n.ReadAt == null).ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, DateTime.UtcNow));
        return NoContent();
    }
}
