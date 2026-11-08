using System.Text.Json;
using Sicou.Api.Integrations;
using Sicou.Application.Responses.Workflows;
using Sicou.Domain.Enums;
using Sicou.Infrastructure.Services;

namespace Sicou.UnitTests;

public class IntegrationWorkflowTests
{
    private static readonly Guid Start = Guid.NewGuid(), Review = Guid.NewGuid(), Approved = Guid.NewGuid(), Rejected = Guid.NewGuid();
    private static readonly Guid Cpf = Guid.NewGuid(), Salary = Guid.NewGuid(), Opinion = Guid.NewGuid();

    private static ProcessTypeResponse Tree() => new()
    {
        Id = Guid.NewGuid(),
        StartNodeId = Start,
        StartNodeName = "Abertura",
        Nodes =
        [
            new() { ProcessNodeId = Start, Code = "ABERTURA", Name = "Abertura", NodeType = ProcessNodeType.StartConfection },
            new() { ProcessNodeId = Review, Code = "ANALISE", Name = "Análise", NodeType = ProcessNodeType.ApprovalStage },
            new() { ProcessNodeId = Approved, Code = "DEFERIDO", Name = "Deferido", NodeType = ProcessNodeType.EndApproved },
            new() { ProcessNodeId = Rejected, Code = "INDEFERIDO", Name = "Indeferido", NodeType = ProcessNodeType.EndRejected }
        ],
        Fields =
        [
            new() { FieldDefinitionId = Cpf, Code = "CPF_CANDIDATO", Name = "CPF", Type = FieldType.Cpf, ProcessNodeId = Start, IsRequired = true },
            new() { FieldDefinitionId = Salary, Code = "SALARIO", Name = "Salário", Type = FieldType.Currency, ProcessNodeId = Start },
            new() { FieldDefinitionId = Opinion, Code = "PARECER", Name = "Parecer", Type = FieldType.TextArea, ProcessNodeId = Review, IsRequired = true, CustomLabel = "Parecer do RH" }
        ],
        Transitions =
        [
            new() { FromNodeId = Start, ToNodeId = Review, ToNodeName = "Análise", AllowAdvance = true },
            new() { FromNodeId = Review, ToNodeId = Approved, ToNodeName = "Deferido", AllowAdvance = true },
            new() { FromNodeId = Review, ToNodeId = Rejected, ToNodeName = "Indeferido", AllowAdvance = true }
        ]
    };

    private static IntegrationFieldValues Fields(string json)
    {
        var values = new IntegrationFieldValues();
        foreach (var p in JsonDocument.Parse(json).RootElement.EnumerateObject()) values[p.Name] = p.Value.Clone();
        return values;
    }

    [Fact]
    public void ResolvesFieldsByCodeCaseInsensitiveOrById()
    {
        var resolved = IntegrationWorkflowMapper.ResolveFields(
            Fields($$"""{"cpf_candidato":"52998224725","{{Salary}}":3500.5}"""), Tree());

        Assert.Equal("52998224725", resolved[Cpf]);
        Assert.Equal("3500.5", resolved[Salary]);
    }

    [Fact]
    public void ConvertsBooleansListsAndNullsToTheTextFormatUsedByTheWebUi()
    {
        Assert.Equal("true", IntegrationWorkflowMapper.ToText(JsonDocument.Parse("true").RootElement, "x"));
        Assert.Equal("A,B,3", IntegrationWorkflowMapper.ToText(JsonDocument.Parse("""[" A ","B",3]""").RootElement, "x"));
        Assert.Null(IntegrationWorkflowMapper.ToText(JsonDocument.Parse("null").RootElement, "x"));
        Assert.Throws<InvalidOperationException>(() => IntegrationWorkflowMapper.ToText(JsonDocument.Parse("""{"a":1}""").RootElement, "x"));
    }

    [Fact]
    public void RejectsFieldsOutsideTheWorkflowListingValidCodes()
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            IntegrationWorkflowMapper.ResolveFields(Fields($$"""{"NAO_EXISTE":"x","{{Guid.NewGuid()}}":"y"}"""), Tree()));
        Assert.Contains("NAO_EXISTE", ex.Message);
        Assert.Contains("CPF_CANDIDATO", ex.Message);
    }

    [Fact]
    public void ResolvesTargetNodeByCodeAndDetectsConflicts()
    {
        Assert.Equal(Approved, IntegrationWorkflowMapper.ResolveNode(null, "deferido", Tree()));
        Assert.Equal(Review, IntegrationWorkflowMapper.ResolveNode(Review, null, Tree()));
        Assert.Null(IntegrationWorkflowMapper.ResolveNode(null, " ", Tree()));
        Assert.Throws<InvalidOperationException>(() => IntegrationWorkflowMapper.ResolveNode(Rejected, "DEFERIDO", Tree()));
        Assert.Throws<InvalidOperationException>(() => IntegrationWorkflowMapper.ResolveNode(null, "INEXISTENTE", Tree()));
    }

    private static ProcessInstanceResponse Process(ProcessStatus status, Guid node, bool canManipulate, params ProcessFieldValueResponse[] values) => new()
    {
        Id = Guid.NewGuid(), Status = status, CurrentNodeId = node, CanManipulate = canManipulate,
        CurrentNodeName = "?", FieldValues = values.ToList()
    };

    [Fact]
    public void StatusInReviewListsTargetsPendingFieldsAndActions()
    {
        var status = IntegrationWorkflowMapper.BuildStatus(Process(ProcessStatus.InReview, Review, true), Tree());

        Assert.Equal("ANALISE", status.CurrentNode.Code);
        Assert.Equal("Em análise", status.StatusLabel);
        Assert.Equal([Approved, Rejected], status.AdvanceTargets.Select(t => t.Id));
        Assert.Equal(Start, Assert.Single(status.ReturnTargets).Id); // sem retorno explícito, volta à etapa inicial
        Assert.Equal("Parecer do RH", Assert.Single(status.PendingRequiredFields).Name);
        Assert.Equal(["advance", "return", "restart", "comment", "cancel", "transfer"], status.AvailableActions);
    }

    [Fact]
    public void StatusOmitsMovementWhenTheTokenOwnerCannotHandleTheStage()
    {
        var status = IntegrationWorkflowMapper.BuildStatus(Process(ProcessStatus.InReview, Review, false), Tree());
        Assert.DoesNotContain("advance", status.AvailableActions);
        Assert.DoesNotContain("return", status.AvailableActions);
        Assert.False(status.CanManipulate);
    }

    [Fact]
    public void DraftWithFilledFieldsHasNoPendingAndOffersSubmit()
    {
        var status = IntegrationWorkflowMapper.BuildStatus(
            Process(ProcessStatus.Draft, Start, true, new ProcessFieldValueResponse { FieldDefinitionId = Cpf, Value = "52998224725" }), Tree());
        Assert.Empty(status.PendingRequiredFields);
        Assert.Contains("submit", status.AvailableActions);
        Assert.Empty(status.ReturnTargets); // já está na etapa inicial
    }

    [Fact]
    public void TerminalStatusHasNoActions()
    {
        var status = IntegrationWorkflowMapper.BuildStatus(Process(ProcessStatus.AdministrativeCancellation, Review, true), Tree());
        Assert.True(status.IsTerminal);
        Assert.Empty(status.AvailableActions);
        Assert.Empty(status.AdvanceTargets);
        Assert.False(status.CanManipulate);
    }

    [Fact]
    public void SecretsAreRandomPrefixedAndStoredOnlyAsSha256Hex()
    {
        var a = IntegrationTokenService.GenerateSecret();
        var b = IntegrationTokenService.GenerateSecret();
        Assert.StartsWith("sic_", a);
        Assert.NotEqual(a, b);
        Assert.Equal(47, a.Length); // "sic_" + 32 bytes em base64url sem preenchimento
        Assert.DoesNotContain('+', a);
        Assert.DoesNotContain('/', a);
        var hash = IntegrationTokenService.HashSecret(a);
        Assert.Matches("^[0-9a-f]{64}$", hash);
        Assert.Equal(hash, IntegrationTokenService.HashSecret(a));
        Assert.NotEqual(hash, IntegrationTokenService.HashSecret(b));
    }
}
