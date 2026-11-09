using System.ComponentModel.DataAnnotations;

namespace Sicou.Application.Requests.Integrations;

/// <summary>Cadastro de integração (UC-020): nome, sistema externo e escopo de acesso.</summary>
public class CreateIntegrationTokenRequest
{
    /// <summary>Nome da integração, ex.: "Robô de admissões".</summary>
    [Required(ErrorMessage = "Informe o nome da integração.")]
    [StringLength(100, MinimumLength = 3, ErrorMessage = "O nome deve ter entre 3 e 100 caracteres.")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Sistema externo que usará a integração, ex.: "Agente de IA do RH".</summary>
    [Required(ErrorMessage = "Informe o sistema externo.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "O sistema externo deve ter entre 2 e 100 caracteres.")]
    public string ExternalSystem { get; set; } = string.Empty;

    [MinLength(1, ErrorMessage = "Selecione pelo menos um escopo.")]
    public List<string> Scopes { get; set; } = new();

    /// <summary>
    /// Empresa da integração. Admin da Empresa: ignorado (sempre a própria empresa). Super Admin/Desenvolvedor:
    /// obrigatório, preenchido pela interface a partir da empresa selecionada no seletor corporativo.
    /// </summary>
    public Guid? CompanyId { get; set; }
}
