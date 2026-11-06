using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Repositories;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Users;
using Sicou.Application.Responses.Users;
using Sicou.Domain.Constants;
using Sicou.Domain.Entities;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly ICompanyRepository _companyRepository;
    private readonly IUnitRepository _unitRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly ApplicationDbContext _context;

    public UserService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        ICompanyRepository companyRepository,
        IUnitRepository unitRepository,
        ICurrentUserService currentUserService,
        ApplicationDbContext context)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _companyRepository = companyRepository;
        _unitRepository = unitRepository;
        _currentUserService = currentUserService;
        _context = context;
    }

    public async Task<UserResponse> CreateAsync(CreateUserRequest request)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsPlatformAdminAsync(currentUser);

        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new InvalidOperationException("O nome completo é obrigatório.");

        if (string.IsNullOrWhiteSpace(request.Email))
            throw new InvalidOperationException("O e-mail é obrigatório.");

        if (string.IsNullOrWhiteSpace(request.Password))
            throw new InvalidOperationException("A senha é obrigatória.");

        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
            throw new InvalidOperationException("Já existe um usuário cadastrado com este e-mail.");

        Guid? targetCompanyId = request.CompanyId;
        if (!isSuperAdmin)
        {
            if (!currentUser.CompanyId.HasValue)
                throw new UnauthorizedAccessException("Seu usuário não está vinculado a uma empresa.");

            targetCompanyId = currentUser.CompanyId.Value;

            if (SystemRoles.IsPlatformAdmin(request.Roles))
                throw new UnauthorizedAccessException("Você não tem permissão para conceder os perfis Super Admin ou Desenvolvedor.");
        }

        if (targetCompanyId.HasValue)
        {
            var company = await _companyRepository.GetByIdAsync(targetCompanyId.Value);
            if (company is null || !company.IsActive)
                throw new InvalidOperationException("Empresa não encontrada ou inativa.");
        }

        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);
            if (unit is null || !unit.IsActive)
                throw new InvalidOperationException("Unidade não encontrada ou inativa.");

            if (targetCompanyId.HasValue && unit.CompanyId != targetCompanyId.Value)
                throw new InvalidOperationException("A unidade informada não pertence à empresa selecionada.");
        }

        foreach (var role in request.Roles)
        {
            var roleExists = await _roleManager.RoleExistsAsync(role);
            if (!roleExists)
                throw new InvalidOperationException($"Role inválida: {role}");
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName.Trim(),
            CompanyId = targetCompanyId,
            UnitId = request.UnitId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" | ", result.Errors.Select(x => x.Description)));

        if (request.Roles.Count > 0)
        {
            var roleResult = await _userManager.AddToRolesAsync(user, request.Roles);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(string.Join(" | ", roleResult.Errors.Select(x => x.Description)));
        }

        return await MapToResponseAsync(user);
    }

    public async Task<List<UserResponse>> GetAllAsync()
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsPlatformAdminAsync(currentUser);

        var query = _userManager.Users.AsNoTracking();

        if (!isSuperAdmin)
        {
            if (!currentUser.CompanyId.HasValue)
                return new List<UserResponse>();

            query = query.Where(u => u.CompanyId == currentUser.CompanyId.Value);
        }

        var users = await query
            .OrderBy(x => x.FullName)
            .ToListAsync();

        var responses = new List<UserResponse>();
        foreach (var user in users)
        {
            responses.Add(await MapToResponseAsync(user));
        }

        return responses;
    }

    public async Task<UserResponse?> GetByIdAsync(string id)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsPlatformAdminAsync(currentUser);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return null;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para visualizar este usuário.");

        return await MapToResponseAsync(user);
    }

    public async Task<UserResponse?> UpdateAsync(string id, UpdateUserRequest request)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsPlatformAdminAsync(currentUser);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return null;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para editar este usuário.");

        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new InvalidOperationException("O nome completo é obrigatório.");

        Guid? targetCompanyId = isSuperAdmin ? request.CompanyId : currentUser.CompanyId;

        if (targetCompanyId.HasValue)
        {
            var company = await _companyRepository.GetByIdAsync(targetCompanyId.Value);
            if (company is null || !company.IsActive)
                throw new InvalidOperationException("Empresa não encontrada ou inativa.");
        }

        if (request.UnitId.HasValue)
        {
            var unit = await _unitRepository.GetByIdAsync(request.UnitId.Value);
            if (unit is null || !unit.IsActive)
                throw new InvalidOperationException("Unidade não encontrada ou inativa.");

            if (targetCompanyId.HasValue && unit.CompanyId != targetCompanyId.Value)
                throw new InvalidOperationException("A unidade informada não pertence à empresa selecionada.");
        }

        // Atualização de e-mail se fornecido e modificado
        if (!string.IsNullOrWhiteSpace(request.Email) && !string.Equals(request.Email, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var emailExists = await _userManager.FindByEmailAsync(request.Email);
            if (emailExists is not null && emailExists.Id != user.Id)
                throw new InvalidOperationException("Já existe outro usuário cadastrado com este e-mail.");

            user.Email = request.Email.Trim();
            user.UserName = request.Email.Trim();
            user.NormalizedEmail = _userManager.NormalizeEmail(request.Email.Trim());
            user.NormalizedUserName = _userManager.NormalizeName(request.Email.Trim());
        }

        var previousCompanyId = user.CompanyId;
        var previousUnitId = user.UnitId;
        var isTransfer = previousCompanyId != targetCompanyId || previousUnitId != request.UnitId;

        user.FullName = request.FullName.Trim();
        user.CompanyId = targetCompanyId;
        user.UnitId = request.UnitId;
        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        // A transferência (RF-010) grava usuário, acessos e registro juntos: qualquer falha desfaz tudo.
        await using var transaction = isTransfer ? await _context.Database.BeginTransactionAsync() : null;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" | ", result.Errors.Select(x => x.Description)));

        if (transaction is not null)
        {
            await ApplyTransferAsync(user, previousCompanyId, previousUnitId, request.CopyAccessesToNewUnit, currentUser);
            // Sessões abertas carregam a empresa e a unidade antigas; o usuário precisa entrar novamente.
            await _userManager.UpdateSecurityStampAsync(user);
            await transaction.CommitAsync();
        }

        return await MapToResponseAsync(user);
    }

    /// <summary>
    /// RF-010: desativa os acessos de setor que não correspondem à nova empresa/unidade, recria-os na nova unidade
    /// quando solicitado (somente na mesma empresa) e registra a transferência.
    /// Sem cópia, as atribuições a locais de processo também são desativadas.
    /// </summary>
    private async Task ApplyTransferAsync(ApplicationUser user, Guid? fromCompanyId, Guid? fromUnitId,
        bool copyRequested, ApplicationUser actor)
    {
        var userId = user.Id.ToString();
        var now = DateTime.UtcNow;
        var copy = copyRequested && fromCompanyId.HasValue && fromCompanyId == user.CompanyId;

        var revoked = await _context.UserAreaAccesses
            .Where(a => a.UserId == userId && a.IsActive && (a.CompanyId != user.CompanyId || a.UnitId != user.UnitId))
            .ToListAsync();
        foreach (var access in revoked)
        {
            access.IsActive = false;
            access.UpdatedAt = now;
        }

        var copied = 0;
        if (copy)
        {
            var companyId = user.CompanyId!.Value;
            var activeAreaIds = await _context.Areas
                .Where(a => a.CompanyId == companyId && a.IsActive)
                .Select(a => a.Id)
                .ToListAsync();
            var targetRows = await _context.UserAreaAccesses
                .Where(a => a.UserId == userId && a.CompanyId == companyId && a.UnitId == user.UnitId)
                .ToListAsync();

            foreach (var group in revoked.Where(a => a.CompanyId == companyId && activeAreaIds.Contains(a.AreaId)).GroupBy(a => a.AreaId))
            {
                var target = targetRows.FirstOrDefault(a => a.AreaId == group.Key);
                if (target is { IsActive: true })
                    continue; // Acesso já configurado na nova unidade: mantido como está, sem ampliar permissões.

                if (target is null)
                {
                    target = new UserAreaAccess { UserId = userId, CompanyId = companyId, UnitId = user.UnitId, AreaId = group.Key };
                    _context.UserAreaAccesses.Add(target);
                }

                target.CanView = group.Any(a => a.CanView);
                target.CanManage = group.Any(a => a.CanManage);
                target.CanPublishInformatives = group.Any(a => a.CanPublishInformatives);
                target.CanManageGuide = group.Any(a => a.CanManageGuide);
                target.CanManageWorkflows = group.Any(a => a.CanManageWorkflows);
                target.CanHandleWorkflowRequests = group.Any(a => a.CanHandleWorkflowRequests);
                target.IsActive = true;
                target.UpdatedAt = now;
                copied++;
            }
        }

        var revokedNodes = 0;
        if (!copy)
        {
            var nodes = await _context.UserProcessNodes.Where(n => n.UserId == userId && n.IsActive).ToListAsync();
            foreach (var node in nodes)
            {
                node.IsActive = false;
                node.UpdatedAt = now;
            }
            revokedNodes = nodes.Count;
        }

        var companyIds = new[] { fromCompanyId, user.CompanyId }.Where(x => x.HasValue).Select(x => x!.Value).ToList();
        var unitIds = new[] { fromUnitId, user.UnitId }.Where(x => x.HasValue).Select(x => x!.Value).ToList();
        var companyNames = await _context.Companies.Where(c => companyIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name);
        var unitNames = await _context.Units.Where(u => unitIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);

        _context.UserTransfers.Add(new UserTransfer
        {
            UserId = user.Id,
            FromCompanyId = fromCompanyId,
            FromCompanyName = fromCompanyId.HasValue ? companyNames.GetValueOrDefault(fromCompanyId.Value) : null,
            FromUnitId = fromUnitId,
            FromUnitName = fromUnitId.HasValue ? unitNames.GetValueOrDefault(fromUnitId.Value) : null,
            ToCompanyId = user.CompanyId,
            ToCompanyName = user.CompanyId.HasValue ? companyNames.GetValueOrDefault(user.CompanyId.Value) : null,
            ToUnitId = user.UnitId,
            ToUnitName = user.UnitId.HasValue ? unitNames.GetValueOrDefault(user.UnitId.Value) : null,
            PerformedByUserId = actor.Id,
            PerformedByName = actor.FullName,
            CopyAccessesRequested = copyRequested,
            RevokedAreaAccesses = revoked.Count,
            CopiedAreaAccesses = copied,
            RevokedProcessNodes = revokedNodes
        });

        await _context.SaveChangesAsync();
    }

    public async Task<IReadOnlyList<UserTransferResponse>?> GetTransfersAsync(string id)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsPlatformAdminAsync(currentUser);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return null;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para visualizar este usuário.");

        var transfers = await _context.UserTransfers.AsNoTracking()
            .Where(t => t.UserId == user.Id)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        return transfers.Select(t => new UserTransferResponse(
            t.Id, t.CreatedAt,
            t.FromCompanyName, UnitLabel(t.FromCompanyId, t.FromUnitName),
            t.ToCompanyName, UnitLabel(t.ToCompanyId, t.ToUnitName),
            t.PerformedByName, t.CopyAccessesRequested,
            t.RevokedAreaAccesses, t.CopiedAreaAccesses, t.RevokedProcessNodes)).ToList();
    }

    private static string UnitLabel(Guid? companyId, string? unitName)
        => unitName ?? (companyId.HasValue ? "Sede" : "Sem empresa");

    public async Task<bool> DeleteAsync(string id)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsPlatformAdminAsync(currentUser);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return false;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para inativar este usuário.");

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" | ", result.Errors.Select(x => x.Description)));

        return true;
    }

    public async Task<UserResponse?> UpdateRolesAsync(string id, UpdateUserRolesRequest request)
    {
        var currentUser = await GetActiveCurrentUserAsync();
        var isSuperAdmin = await _userManager.IsPlatformAdminAsync(currentUser);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
            return null;

        if (!isSuperAdmin && user.CompanyId != currentUser.CompanyId)
            throw new UnauthorizedAccessException("Você não tem permissão para alterar as permissões deste usuário.");

        if (!isSuperAdmin && SystemRoles.IsPlatformAdmin(request.Roles))
            throw new UnauthorizedAccessException("Você não tem permissão para conceder os perfis Super Admin ou Desenvolvedor.");

        foreach (var role in request.Roles)
        {
            var roleExists = await _roleManager.RoleExistsAsync(role);
            if (!roleExists)
                throw new InvalidOperationException($"Role inválida: {role}");
        }

        var currentRoles = await _userManager.GetRolesAsync(user);
        var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
        if (!removeResult.Succeeded)
            throw new InvalidOperationException(string.Join(" | ", removeResult.Errors.Select(x => x.Description)));

        if (request.Roles.Count > 0)
        {
            var addResult = await _userManager.AddToRolesAsync(user, request.Roles);
            if (!addResult.Succeeded)
                throw new InvalidOperationException(string.Join(" | ", addResult.Errors.Select(x => x.Description)));
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _userManager.UpdateAsync(user);

        return await MapToResponseAsync(user);
    }

    private async Task<ApplicationUser> GetActiveCurrentUserAsync()
    {
        if (string.IsNullOrWhiteSpace(_currentUserService.UserId))
            throw new UnauthorizedAccessException("Usuário não autenticado.");

        var user = await _userManager.FindByIdAsync(_currentUserService.UserId);
        if (user is null || !user.IsActive)
            throw new UnauthorizedAccessException("Usuário atual não encontrado ou inativo.");

        return user;
    }

    private async Task<UserResponse> MapToResponseAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var company = user.CompanyId.HasValue
            ? await _companyRepository.GetByIdAsync(user.CompanyId.Value)
            : null;
        var unit = user.UnitId.HasValue
            ? await _unitRepository.GetByIdAsync(user.UnitId.Value)
            : null;

        return new UserResponse
        {
            Id = user.Id.ToString(),
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            IsActive = user.IsActive,
            CompanyId = user.CompanyId,
            UnitId = user.UnitId,
            CompanyName = company?.Name,
            UnitName = unit?.Name,
            Roles = roles.ToList(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}