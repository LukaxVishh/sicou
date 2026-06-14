namespace Sicou.Api.Responses;

public sealed class ApiErrorResponse
{
    public string Message { get; set; } = string.Empty;

    public int StatusCode { get; set; }

    public string? Details { get; set; }
}