using Sicou.Application.Requests.Users;
using Sicou.Application.Responses.Users;

namespace Sicou.Application.Interfaces.Services;

public interface IUserService
{
    Task<UserResponse> CreateAsync(CreateUserRequest request);

    Task<List<UserResponse>> GetAllAsync();

    Task<UserResponse?> GetByIdAsync(string id);

    Task<UserResponse?> UpdateAsync(string id, UpdateUserRequest request);

    Task<bool> DeleteAsync(string id);

    Task<UserResponse?> UpdateRolesAsync(string id, UpdateUserRolesRequest request);
}