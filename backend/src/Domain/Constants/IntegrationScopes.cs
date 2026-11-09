namespace Sicou.Domain.Constants;

/// <summary>
/// Escopos dos tokens de integração (UC-020). O escopo libera a rota; as regras de perfil, setor, unidade e etapa
/// do usuário dono do token continuam sendo aplicadas pelos serviços de negócio.
/// </summary>
public static class IntegrationScopes
{
    public const string WorkflowsRead = "workflows:read";
    public const string ProcessesRead = "processes:read";
    public const string ProcessesCreate = "processes:create";
    public const string ProcessesMove = "processes:move";
    public const string ProcessesComment = "processes:comment";
    public const string ProcessesCancel = "processes:cancel";
    public const string ProcessesTransfer = "processes:transfer";

    public static readonly IReadOnlyDictionary<string, string> Descriptions = new Dictionary<string, string>
    {
        [WorkflowsRead] = "Consultar os workflows (tipos de processo) disponíveis, com etapas, campos e transições.",
        [ProcessesRead] = "Consultar processos, status, ações disponíveis e histórico.",
        [ProcessesCreate] = "Abrir processos, editar rascunhos e protocolar.",
        [ProcessesMove] = "Tramitar processos: avançar, devolver e reiniciar.",
        [ProcessesComment] = "Registrar parecer/observação em processos.",
        [ProcessesCancel] = "Cancelar processos administrativamente.",
        [ProcessesTransfer] = "Transferir processos entre unidades."
    };

    public static readonly IReadOnlyList<string> All = Descriptions.Keys.ToList();

    public static bool IsValid(string scope) => Descriptions.ContainsKey(scope);
}
