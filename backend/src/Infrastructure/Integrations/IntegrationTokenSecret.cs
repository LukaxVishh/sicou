using System.Security.Cryptography;
using System.Text;

namespace Sicou.Infrastructure.Integrations;

public static class IntegrationTokenSecret
{
    public const string Prefix = "sic_";
    public static string Create() => Prefix + Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static bool IsWellFormed(string value) => value.Length == 68
        && value.StartsWith(Prefix, StringComparison.Ordinal)
        && value.AsSpan(4).IndexOfAnyExcept("0123456789abcdef") < 0;
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
