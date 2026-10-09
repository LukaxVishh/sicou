using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Options;
using Sicou.Application.Interfaces.Services;

namespace Sicou.Infrastructure.Services;

public class PasswordRecoveryEmailOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = "no-reply@sicou.local";
    public string FrontendBaseUrl { get; set; } = string.Empty;
    public int RequestLimit { get; set; } = 5;
}

public class SmtpPasswordRecoveryEmailSender(IOptions<PasswordRecoveryEmailOptions> options) : IPasswordRecoveryEmailSender
{
    public async Task SendAsync(string email, string link)
    {
        var settings = options.Value;
        using var client = new SmtpClient(settings.Host, settings.Port)
        {
            EnableSsl = settings.EnableSsl,
            UseDefaultCredentials = false,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };
        if (!string.IsNullOrWhiteSpace(settings.Username))
            client.Credentials = new NetworkCredential(settings.Username, settings.Password);
        using var message = new MailMessage
        {
            From = new MailAddress(settings.FromAddress, "Sicou"),
            Subject = "Sicou — recuperação de senha",
            Body = $"Foi solicitada a recuperação da sua senha no Sicou.\n\nConfirme a solicitação e defina sua nova senha pelo link:\n{link}\n\nEste link vale por 30 minutos e pode ser usado uma única vez.\nSe você não solicitou a recuperação, ignore esta mensagem. Sua senha permanece a mesma.",
            BodyEncoding = Encoding.UTF8,
            SubjectEncoding = Encoding.UTF8,
            IsBodyHtml = false
        };
        message.To.Add(new MailAddress(email));
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await client.SendMailAsync(message, timeout.Token);
    }
}
