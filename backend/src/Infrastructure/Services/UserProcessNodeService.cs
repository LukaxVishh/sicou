using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Workflows;
using Sicou.Application.Responses.Users;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class UserProcessNodeService : IUserProcessNodeService
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;

    public UserProcessNodeService(
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager)
    {
        _context = context;
        _currentUser = currentUser;
        _userManager = userManager;
    }

    public async Task<List<ProcessNodeResponse>> GetNodesByUserIdAsync(string userId)
    {
        await ValidateAccessToUserAsync(userId);

        var nodes = await _context.UserProcessNodes
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.IsActive)
            .Include(x => x.ProcessNode)
            .Select(x => x.ProcessNode)
            .ToListAsync();

        return nodes.Select(MapNodeToResponse).ToList();
    }

    public async Task<List<ProcessNodeResponse>> GetMyNodesAsync()
    {
        var currentUserId = _currentUser.UserId;
        if (string.IsNullOrEmpty(currentUserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var nodes = await _context.UserProcessNodes
            .AsNoTracking()
            .Where(x => x.UserId == currentUserId && x.IsActive)
            .Include(x => x.ProcessNode)
            .Select(x => x.ProcessNode)
            .ToListAsync();

        return nodes.Select(MapNodeToResponse).ToList();
    }

    public async Task<List<ProcessNodeResponse>> AssignNodesToUserAsync(string userId, AssignUserProcessNodesRequest request)
    {
        await ValidateCanManageAssignmentsAsync(userId);

        var user = await _userManager.FindByIdAsync(userId)
            ?? throw new KeyNotFoundException($"Usuário com ID '{userId}' não encontrado.");

        var existingAssignments = await _context.UserProcessNodes
            .Where(x => x.UserId == userId)
            .ToListAsync();

        var desiredIds = request.ProcessNodeIds.Distinct().ToList();

        // Verificar existência dos nós
        var validNodes = await _context.ProcessNodes
            .Where(n => desiredIds.Contains(n.Id) && n.IsActive)
            .ToListAsync();

        var validNodeIds = validNodes.Select(n => n.Id).ToHashSet();

        // Desativar removidos
        foreach (var existing in existingAssignments)
        {
            if (!validNodeIds.Contains(existing.ProcessNodeId))
            {
                existing.IsActive = false;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                existing.IsActive = true;
                existing.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Adicionar novos
        var existingNodeIds = existingAssignments.Select(x => x.ProcessNodeId).ToHashSet();
        foreach (var desiredId in validNodeIds)
        {
            if (!existingNodeIds.Contains(desiredId))
            {
                _context.UserProcessNodes.Add(new UserProcessNode
                {
                    UserId = userId,
                    ProcessNodeId = desiredId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _context.SaveChangesAsync();

        return await GetNodesByUserIdAsync(userId);
    }

    public async Task<List<UserResponse>> GetUsersByNodeIdAsync(Guid processNodeId)
    {
        var node = await _context.ProcessNodes.FindAsync(processNodeId)
            ?? throw new KeyNotFoundException($"Local de processo com ID '{processNodeId}' não encontrado.");

        var userIds = await _context.UserProcessNodes
            .AsNoTracking()
            .Where(x => x.ProcessNodeId == processNodeId && x.IsActive)
            .Select(x => x.UserId)
            .ToListAsync();

        var users = await _userManager.Users
            .Where(u => userIds.Contains(u.Id.ToString()) && u.IsActive)
            .ToListAsync();

        var result = new List<UserResponse>();
        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            result.Add(new UserResponse
            {
                Id = u.Id.ToString(),
                FullName = u.FullName,
                Email = u.Email ?? string.Empty,
                IsActive = u.IsActive,
                CompanyId = u.CompanyId,
                UnitId = u.UnitId,
                Roles = roles.ToList(),
                CreatedAt = u.CreatedAt,
                UpdatedAt = u.UpdatedAt
            });
        }

        return result;
    }

    public async Task<List<UserResponse>> AssignUsersToNodeAsync(Guid processNodeId, AssignProcessNodeUsersRequest request)
    {
        var node = await _context.ProcessNodes.FindAsync(processNodeId)
            ?? throw new KeyNotFoundException($"Local de processo com ID '{processNodeId}' não encontrado.");

        await ValidateCanManageNodeAsync(node);

        var existingAssignments = await _context.UserProcessNodes
            .Where(x => x.ProcessNodeId == processNodeId)
            .ToListAsync();

        var desiredUserIds = request.UserIds.Distinct().ToList();

        // Desativar removidos
        foreach (var existing in existingAssignments)
        {
            if (!desiredUserIds.Contains(existing.UserId))
            {
                existing.IsActive = false;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                existing.IsActive = true;
                existing.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Adicionar novos
        var existingUserIds = existingAssignments.Select(x => x.UserId).ToHashSet();
        foreach (var desiredUserId in desiredUserIds)
        {
            if (!existingUserIds.Contains(desiredUserId))
            {
                _context.UserProcessNodes.Add(new UserProcessNode
                {
                    UserId = desiredUserId,
                    ProcessNodeId = processNodeId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _context.SaveChangesAsync();

        return await GetUsersByNodeIdAsync(processNodeId);
    }

    private async Task ValidateAccessToUserAsync(string targetUserId)
    {
        var currentUserId = _currentUser.UserId;
        if (string.IsNullOrEmpty(currentUserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        if (currentUserId == targetUserId)
            return;

        var currentUser = await _userManager.FindByIdAsync(currentUserId)
            ?? throw new UnauthorizedAccessException("Usuário atual não encontrado.");

        var roles = await _userManager.GetRolesAsync(currentUser);
        if (roles.Contains(SystemRoles.SuperAdmin) || roles.Contains(SystemRoles.CompanyAdmin))
            return;

        throw new UnauthorizedAccessException("Você não possui permissão para consultar os locais deste usuário.");
    }

    private async Task ValidateCanManageAssignmentsAsync(string targetUserId)
    {
        var currentUserId = _currentUser.UserId;
        if (string.IsNullOrEmpty(currentUserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var currentUser = await _userManager.FindByIdAsync(currentUserId)
            ?? throw new UnauthorizedAccessException("Usuário atual não encontrado.");

        var roles = await _userManager.GetRolesAsync(currentUser);

        // SuperAdmin e CompanyAdmin podem gerenciar
        if (roles.Contains(SystemRoles.SuperAdmin) || roles.Contains(SystemRoles.CompanyAdmin))
            return;

        throw new UnauthorizedAccessException("Apenas administradores podem atribuir locais de processo a colaboradores.");
    }

    private async Task ValidateCanManageNodeAsync(ProcessNode node)
    {
        var currentUserId = _currentUser.UserId;
        if (string.IsNullOrEmpty(currentUserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var currentUser = await _userManager.FindByIdAsync(currentUserId)
            ?? throw new UnauthorizedAccessException("Usuário atual não encontrado.");

        var roles = await _userManager.GetRolesAsync(currentUser);
        if (roles.Contains(SystemRoles.SuperAdmin))
            return;

        if (roles.Contains(SystemRoles.CompanyAdmin))
        {
            var area = await _context.Areas.FindAsync(node.AreaId);
            if (area != null && area.CompanyId == currentUser.CompanyId)
                return;
        }

        throw new UnauthorizedAccessException("Você não possui permissão para gerenciar a equipe deste local de processo.");
    }

    private static ProcessNodeResponse MapNodeToResponse(ProcessNode node)
    {
        return new ProcessNodeResponse
        {
            Id = node.Id,
            AreaId = node.AreaId,
            Code = node.Code,
            Name = node.Name,
            Description = node.Description,
            NodeType = node.NodeType,
            IsActive = node.IsActive,
            CreatedAt = node.CreatedAt
        };
    }
}
