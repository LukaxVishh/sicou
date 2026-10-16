using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Sicou.Application.Interfaces.Auth;
using Sicou.Application.Interfaces.Services;
using Sicou.Application.Requests.Guide;
using Sicou.Application.Requests.Units;
using Sicou.Application.Requests.Users;
using Sicou.Application.Requests.Workflows;
using Sicou.Domain.Entities;
using Sicou.Domain.Enums;
using Sicou.Domain.Constants;
using Sicou.Infrastructure.Data;
using Sicou.Infrastructure.Identity;

namespace Sicou.Infrastructure.Services;

public class DataImportService(ApplicationDbContext db, ICurrentUserService current, UserManager<ApplicationUser> users,
    IMemoryCache cache, IUnitService units, IUserService userService, IGuideService guides,
    IProcessNodeService nodes, IFieldDefinitionService fields, IProcessTypeService workflows)
{
    private sealed class Plan
    {
        public required string Actor { get; init; }
        public required string Kind { get; init; }
        public Guid CompanyId { get; init; }
        public Guid? AreaId { get; init; }
        public required List<Dictionary<string, string>> Rows { get; init; }
        public required List<WorkflowImport> Workflows { get; init; }
        public DateTime ExpiresAt { get; init; }
        public bool Used { get; set; }
        public SemaphoreSlim Gate { get; } = new(1);
    }
    private async Task<(ApplicationUser Actor, bool Super, bool Admin)> ActorAsync()
    {
        var actor = await users.FindByIdAsync(current.UserId ?? "");
        if (actor is not { IsActive: true }) throw new UnauthorizedAccessException("Usuário inativo ou não autenticado.");
        var roles = await users.GetRolesAsync(actor);
        var super = roles.Contains(SystemRoles.SuperAdmin); var admin = super || roles.Contains(SystemRoles.CompanyAdmin);
        if (!super && !await db.Companies.AnyAsync(c => c.Id == actor.CompanyId && c.IsActive)) throw new UnauthorizedAccessException("Empresa indisponível.");
        if (actor.UnitId.HasValue && !await db.Units.AnyAsync(u => u.Id == actor.UnitId && u.CompanyId == actor.CompanyId && u.IsActive)) throw new UnauthorizedAccessException("Unidade indisponível.");
        return (actor, super, admin);
    }
    public async Task<ImportOptions> OptionsAsync()
    {
        var (actor, super, admin) = await ActorAsync();
        var areas = db.Areas.AsNoTracking().Where(a => a.IsActive && a.Company.IsActive && (super || a.CompanyId == actor.CompanyId));
        var workflowAreas = await areas.Where(a => a.AreaModules.Any(m => m.IsActive && m.Enabled && m.Module.Code == ModuleCode.Workflows)
            && (admin || db.UserAreaAccesses.Any(x => x.UserId == current.UserId && x.CompanyId == a.CompanyId && x.AreaId == a.Id
                && x.UnitId == actor.UnitId && x.IsActive && (x.CanManage || x.CanManageWorkflows))))
            .OrderBy(a => a.Name).Select(a => new ReportOption(a.Id, a.Name, a.CompanyId, null)).ToListAsync();
        var guideAreas = await areas.Where(a => a.AreaModules.Any(m => m.IsActive && m.Enabled && m.Module.Code == ModuleCode.Guide)
            && (admin || db.UserAreaAccesses.Any(x => x.UserId == current.UserId && x.CompanyId == a.CompanyId && x.AreaId == a.Id
                && x.UnitId == actor.UnitId && x.IsActive && (x.CanManage || x.CanManageGuide))))
            .OrderBy(a => a.Name).Select(a => new ReportOption(a.Id, a.Name, a.CompanyId, null)).ToListAsync();
        var areaCompanies = workflowAreas.Concat(guideAreas).Select(a => a.CompanyId).ToArray();
        var companies = await db.Companies.AsNoTracking().Where(c => c.IsActive && (super || c.Id == actor.CompanyId)
            && (admin || areaCompanies.Contains(c.Id))).OrderBy(c => c.Name).Select(c => new ReportOption(c.Id, c.Name, null, null)).ToListAsync();
        var kinds = new List<string>(); if (admin) kinds.AddRange(["units", "users"]);
        if (workflowAreas.Count > 0) kinds.Add("workflows"); if (guideAreas.Count > 0) kinds.Add("guides");
        return new(kinds, companies, workflowAreas, guideAreas);
    }
    private async Task AuthorizeAsync(string kind, Guid companyId, Guid? areaId)
    {
        var options = await OptionsAsync();
        if (!options.Kinds.Contains(kind) || !options.Companies.Any(c => c.Id == companyId)) throw new UnauthorizedAccessException("Importação fora das permissões do seu perfil ou empresa.");
        if (kind is "workflows" or "guides") {
            var areas = kind == "workflows" ? options.WorkflowAreas : options.GuideAreas;
            if (!areas.Any(a => a.Id == areaId && a.CompanyId == companyId)) throw new UnauthorizedAccessException("Selecione um setor autorizado para esta importação.");
        }
        else if (areaId.HasValue) throw new ArgumentException("Este cadastro é da empresa; não selecione setor.");
    }
    public async Task<ImportPreview> PreviewAsync(string kind, Guid companyId, Guid? areaId, string name, byte[] bytes)
    {
        await AuthorizeAsync(kind, companyId, areaId);
        var parsed = ImportFileReader.Read(kind, name, bytes);
        var rows = await ValidateAsync(kind, companyId, areaId, parsed.Rows, parsed.Workflows);
        var valid = rows.Count(r => r.Errors.Count == 0);
        if (valid != rows.Count) return new(null, null, rows.Count, valid, rows);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expires = DateTime.UtcNow.AddMinutes(10);
        var actor = current.UserId!;
        if (cache.TryGetValue<string>("import-actor:" + actor, out var previous) && previous != null) cache.Remove(previous);
        var key = "import-plan:" + token;
        cache.Set(key, new Plan { Actor = actor, Kind = kind, CompanyId = companyId, AreaId = areaId, Rows = parsed.Rows, Workflows = parsed.Workflows, ExpiresAt = expires }, expires);
        cache.Set("import-actor:" + actor, key, expires);
        return new(token, expires, rows.Count, valid, rows);
    }

    private async Task<List<ImportLine>> ValidateAsync(string kind, Guid company, Guid? area, List<Dictionary<string, string>> rows, List<WorkflowImport> definitions)
    {
        var (_, super, _) = await ActorAsync();
        var existingUnits = await db.Units.AsNoTracking().Where(u => u.CompanyId == company).Select(u => new { u.Code, u.Name, u.IsActive }).ToListAsync();
        var unitCodes = existingUnits.Where(u => u.IsActive && u.Code != null).Select(u => u.Code!.ToUpperInvariant()).ToHashSet();
        var unitNames = existingUnits.Select(u => u.Name.ToUpperInvariant()).ToHashSet();
        var allCodes = existingUnits.Where(u => u.Code != null).Select(u => u.Code!.ToUpperInvariant()).ToHashSet();
        var emails = kind == "users" ? (await db.Users.Select(u => u.NormalizedEmail).ToListAsync()).Where(e => e != null).ToHashSet() : [];
        var typeCodes = kind == "workflows" ? (await db.ProcessTypes.Where(t => t.AreaId == area).Select(t => t.Code).ToListAsync()).Select(s => s.ToUpperInvariant()).ToHashSet() : [];
        var nodeCodes = kind == "workflows" ? (await db.ProcessNodes.Where(t => t.AreaId == area).Select(t => t.Code).ToListAsync()).Select(s => s.ToUpperInvariant()).ToHashSet() : [];
        var fieldCodes = kind == "workflows" ? (await db.FieldDefinitions.Where(t => t.AreaId == area).Select(t => t.Code).ToListAsync()).Select(s => s.ToUpperInvariant()).ToHashSet() : [];
        var titles = kind == "guides" ? (await db.Set<GuideItem>().Where(i => i.AreaId == area).Select(i => i.Title).ToListAsync()).Select(s => s.ToUpperInvariant()).ToHashSet() : [];
        var categories = kind == "guides" ? (await db.Set<GuideCategory>().Where(c => c.AreaId == area).Select(c => c.Name).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase) : [];
        var result = new List<ImportLine>();
        for (var index = 0; index < rows.Count; index++) {
            var row = rows[index]; var errors = new List<string>(); var warnings = new List<string>();
            string V(string key) => row.GetValueOrDefault(key, "");
            void Text(string key, int max, bool required = true) {
                if (required && string.IsNullOrWhiteSpace(V(key))) errors.Add($"{key}: preenchimento obrigatório.");
                if (V(key).Length > max) errors.Add($"{key}: máximo de {max} caracteres.");
            }
            if (kind == "units") {
                Text("nome", 200); Text("codigo", 50); Text("cidade", 100, false); Text("uf", 2, false);
                if (V("uf") != "" && !Regex.IsMatch(V("uf"), "^[A-Za-z]{2}$")) errors.Add("uf: use duas letras, como PR.");
                if (!unitNames.Add(V("nome").ToUpperInvariant())) errors.Add("Nome de unidade duplicado no arquivo ou já cadastrado.");
                if (!allCodes.Add(V("codigo").ToUpperInvariant())) errors.Add("Código de unidade duplicado no arquivo ou já cadastrado.");
            }
            else if (kind == "users") {
                Text("nome", 200); Text("email", 256); Text("perfil", 30); Text("unidade_codigo", 50, false);
                if (!new EmailAddressAttribute().IsValid(V("email")) || V("email").Any(char.IsWhiteSpace)) errors.Add("E-mail inválido.");
                var normalized = users.NormalizeEmail(V("email"));
                if (normalized != null && !emails.Add(normalized)) errors.Add("E-mail duplicado no arquivo ou já cadastrado.");
                var role = V("perfil").ToUpperInvariant(); row["perfil"] = role;
                if (!new[] { SystemRoles.CompanyAdmin, SystemRoles.AreaAdmin, SystemRoles.HeadquarterUser, SystemRoles.UnitUser }.Contains(role)
                    || (!super && role == SystemRoles.CompanyAdmin)) errors.Add("Perfil não permitido. Use AREA_ADMIN, HEADQUARTER_USER ou UNIT_USER; COMPANY_ADMIN exige Super Admin.");
                if (role == SystemRoles.UnitUser && !unitCodes.Contains(V("unidade_codigo").ToUpperInvariant())) errors.Add("Informe o código de uma unidade ativa da empresa para UNIT_USER.");
                if (role != SystemRoles.UnitUser && V("unidade_codigo") != "") errors.Add("Perfis da sede devem deixar unidade_codigo vazio.");
                warnings.Add("Será gerada senha temporária individual, válida por 24 horas, com troca obrigatória. Defina as permissões de área após o cadastro.");
            }
            else if (kind == "guides") {
                Text("titulo", 200); Text("categoria", 150); Text("conteudo", 50000, false); Text("url", 2048, false); Text("publicar", 5, false);
                if (!titles.Add(V("titulo").ToUpperInvariant())) errors.Add("Título duplicado no arquivo ou já cadastrado neste setor.");
                if (V("url") != "" && (!Uri.TryCreate(V("url"), UriKind.Absolute, out var link) || link.Scheme is not ("http" or "https"))) errors.Add("url: informe um endereço http ou https.");
                if (!TryBoolean(V("publicar"), out _)) errors.Add("publicar: use sim ou nao.");
                if (!categories.Contains(V("categoria"))) warnings.Add("A categoria será criada neste setor.");
            }
            else ValidateWorkflow(definitions[index], errors, typeCodes, nodeCodes, fieldCodes);
            result.Add(new(index + (kind == "workflows" ? 1 : 2), new(row), errors, warnings));
        }
        return result;
    }

    private static bool TryBoolean(string text, out bool value) {
        value = new[] { "sim", "true", "1" }.Contains(text.ToLowerInvariant());
        return value || new[] { "", "nao", "não", "false", "0" }.Contains(text.ToLowerInvariant());
    }
    private static ProcessAudience? Audience(string? value) => value?.ToLowerInvariant() switch { "todos" => ProcessAudience.All, "sede" => ProcessAudience.HeadquartersOnly, "unidades" => ProcessAudience.UnitsOnly, _ => null };
    private static ProcessNodeType? StageType(string? value) => value?.ToLowerInvariant() switch { "inicio" => ProcessNodeType.StartConfection, "etapa" => ProcessNodeType.StandardStage, "aprovacao" => ProcessNodeType.ApprovalStage, "fim" => ProcessNodeType.EndArchived, _ => null };
    private static bool Code(string? code) => code != null && Regex.IsMatch(code, "^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$");
    private static string FullCode(WorkflowImport w, string child) => w.Codigo.ToUpperInvariant() + "-" + child.ToUpperInvariant();
    private static void ValidateWorkflow(WorkflowImport w, List<string> errors, HashSet<string> types, HashSet<string> nodes, HashSet<string> fields)
    {
        if (!Code(w.Codigo)) errors.Add("codigo: use de 1 a 20 letras, números, hífen ou sublinhado.");
        if (string.IsNullOrWhiteSpace(w.Nome) || w.Nome.Length > 200) errors.Add("nome: obrigatório, até 200 caracteres.");
        if (w.Descricao == null || w.Descricao.Length > 1000) errors.Add("descricao: até 1.000 caracteres.");
        if (Audience(w.Publico) == null) errors.Add("publico: use Todos, Sede ou Unidades.");
        if (!types.Add((w.Codigo ?? "").ToUpperInvariant())) errors.Add("Código de workflow duplicado ou já cadastrado no setor.");
        var stages = w.Etapas ??= []; var columns = w.Campos ??= []; var transitions = w.Transicoes ??= [];
        if (stages.Count is < 2 or > 20 || columns.Count > 30 || transitions.Count is < 1 or > 50) { errors.Add("Limites: 2–20 etapas, até 30 campos e 1–50 transições."); return; }
        if (stages.Any(s => s == null) || columns.Any(c => c == null) || transitions.Any(t => t == null)) { errors.Add("Etapas, campos e transições devem ser objetos válidos."); return; }
        var stageCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in stages) {
            if (!Code(s.Codigo) || !stageCodes.Add(s.Codigo ?? "")) errors.Add("Código de etapa inválido ou repetido.");
            if (string.IsNullOrWhiteSpace(s.Nome) || s.Nome.Length > 200 || StageType(s.Tipo) == null) errors.Add("Etapa com nome ou tipo inválido.");
            if (Code(w.Codigo) && Code(s.Codigo) && !nodes.Add(FullCode(w, s.Codigo!))) errors.Add("Código de etapa já cadastrado no setor.");
        }
        if (stages.Count(s => StageType(s.Tipo) == ProcessNodeType.StartConfection) != 1 || stages.Count(s => StageType(s.Tipo) == ProcessNodeType.EndArchived) != 1) errors.Add("Defina exatamente uma etapa inicio e uma fim.");
        var columnCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in columns) {
            if (!Code(c.Codigo) || !columnCodes.Add(c.Codigo ?? "")) errors.Add("Código de campo inválido ou repetido.");
            if (string.IsNullOrWhiteSpace(c.Nome) || c.Nome.Length > 200 || c.Etapa == null || !stageCodes.Contains(c.Etapa)) errors.Add("Campo com nome ou etapa inválidos.");
            if (!Enum.TryParse<FieldType>(c.Tipo, true, out var type) || !Enum.IsDefined(type) || type == FieldType.FileAttachment) errors.Add("Tipo de campo inválido; anexos não são importados.");
            if (c.Opcoes == null || c.Opcoes.Count > 100 || c.Opcoes.Any(o => string.IsNullOrWhiteSpace(o) || o.Length > 200)) errors.Add("Opções de campo inválidas (máximo 100, até 200 caracteres cada).");
            else if (type is FieldType.Select or FieldType.MultiSelect && c.Opcoes.Count == 0) errors.Add("Campos Select/MultiSelect precisam de opções.");
            if (Code(w.Codigo) && Code(c.Codigo) && !fields.Add(FullCode(w, c.Codigo!))) errors.Add("Código de campo já cadastrado no setor.");
        }
        var pairs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var t in transitions)
            if (t.Origem == null || t.Destino == null || !stageCodes.Contains(t.Origem) || !stageCodes.Contains(t.Destino)
                || t.Origem.Equals(t.Destino, StringComparison.OrdinalIgnoreCase) || !pairs.Add(t.Origem + ":" + t.Destino)) errors.Add("Transição inválida, repetida ou com etapa inexistente.");
        if (errors.Count == 0) {
            var reached = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { stages.Single(s => StageType(s.Tipo) == ProcessNodeType.StartConfection).Codigo };
            bool changed; do { changed = false; foreach (var t in transitions) if (reached.Contains(t.Origem)) changed |= reached.Add(t.Destino); } while (changed);
            if (reached.Count != stages.Count) errors.Add("Todas as etapas precisam ser alcançáveis a partir do inicio.");
            var terminal = stages.Single(s => StageType(s.Tipo) == ProcessNodeType.EndArchived).Codigo;
            var canEnd = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { terminal };
            do { changed = false; foreach (var t in transitions) if (canEnd.Contains(t.Destino)) changed |= canEnd.Add(t.Origem); } while (changed);
            if (canEnd.Count != stages.Count || transitions.Any(t => t.Origem.Equals(terminal, StringComparison.OrdinalIgnoreCase))) errors.Add("Todas as etapas devem permitir chegar ao fim, que não pode ter saída.");
        }
    }

    public async Task<ImportResult> ConfirmAsync(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length != 64 || !cache.TryGetValue<Plan>("import-plan:" + token, out var plan) || plan == null)
            throw new ArgumentException("Prévia expirada ou já utilizada. Valide o arquivo novamente.");
        if (plan.Actor != current.UserId) throw new UnauthorizedAccessException("Esta prévia pertence a outro usuário.");
        if (!await plan.Gate.WaitAsync(0, ct)) throw new ArgumentException("Esta importação já está em andamento.");
        try {
            if (plan.Used || plan.ExpiresAt <= DateTime.UtcNow) throw new ArgumentException("Prévia expirada ou já utilizada.");
            plan.Used = true; cache.Remove("import-plan:" + token);
            await AuthorizeAsync(plan.Kind, plan.CompanyId, plan.AreaId);
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({"import:" + plan.CompanyId}))", ct);
            var validation = await ValidateAsync(plan.Kind, plan.CompanyId, plan.AreaId, plan.Rows, plan.Workflows);
            if (validation.Any(r => r.Errors.Count > 0)) throw new ArgumentException("Os cadastros mudaram desde a prévia. Valide novamente para verificar duplicidades ou referências.");
            var credentials = new List<ImportCredential>();
            for (var i = 0; i < plan.Rows.Count; i++) {
                ct.ThrowIfCancellationRequested(); var row = plan.Rows[i]; string V(string k) => row.GetValueOrDefault(k, "");
                if (plan.Kind == "units") await units.CreateAsync(plan.CompanyId, new CreateUnitRequest { Name = V("nome"), Code = V("codigo"), City = V("cidade"), State = V("uf") });
                else if (plan.Kind == "users") {
                    var password = "Imp!" + Convert.ToHexString(RandomNumberGenerator.GetBytes(16)) + "a1";
                    Guid? unitId = null;
                    if (V("unidade_codigo") != "") { var code = V("unidade_codigo").ToUpperInvariant(); unitId = await db.Units.Where(u => u.CompanyId == plan.CompanyId && u.IsActive && u.Code != null && u.Code.ToUpper() == code).Select(u => (Guid?)u.Id).SingleAsync(ct); }
                    var created = await userService.CreateAsync(new CreateUserRequest { FullName = V("nome"), Email = V("email"), Password = password, CompanyId = plan.CompanyId, UnitId = unitId, Roles = [V("perfil")] });
                    var user = await users.FindByIdAsync(created.Id.ToString()) ?? throw new InvalidOperationException("Usuário importado indisponível.");
                    user.MustChangePassword = true; user.TemporaryPasswordExpiresAt = DateTime.UtcNow.AddHours(24); user.PasswordRecoveryAt = DateTime.UtcNow; user.PasswordRecoveryByUserId = Guid.Parse(plan.Actor);
                    var saved = await users.UpdateAsync(user); if (!saved.Succeeded) throw new InvalidOperationException("Não foi possível configurar a senha temporária.");
                    credentials.Add(new(user.Email!, password, user.TemporaryPasswordExpiresAt.Value));
                }
                else if (plan.Kind == "guides") {
                    var categoryName = V("categoria");
                    var categoryId = await db.Set<GuideCategory>().Where(c => c.AreaId == plan.AreaId && c.Name.ToLower() == categoryName.ToLower()).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(ct);
                    categoryId ??= (await guides.SaveCategoryAsync(plan.AreaId!.Value, null, new GuideCategoryRequest { Name = categoryName })).Id;
                    TryBoolean(V("publicar"), out var published);
                    await guides.SaveItemAsync(plan.AreaId!.Value, null, new GuideItemRequest { CategoryId = categoryId.Value, Title = V("titulo"), Content = V("conteudo"), Url = V("url"), IsPublished = published });
                }
                else await CreateWorkflowAsync(plan.AreaId!.Value, plan.Workflows[i]);
            }
            await transaction.CommitAsync(ct);
            return new(plan.Kind, plan.Rows.Count, credentials);
        }
        catch (DbUpdateException) { throw new ArgumentException("Conflito ao gravar os cadastros. Nenhum registro desta importação foi salvo; valide novamente."); }
        finally { plan.Gate.Release(); }
    }

    private async Task CreateWorkflowAsync(Guid area, WorkflowImport w)
    {
        var nodeIds = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var n in w.Etapas) nodeIds.Add(n.Codigo, (await nodes.CreateAsync(area, new CreateProcessNodeRequest { Code = FullCode(w, n.Codigo), Name = n.Nome, NodeType = StageType(n.Tipo)!.Value })).Id);
        var fieldInputs = new List<ProcessTypeFieldInput>();
        foreach (var f in w.Campos) {
            var type = Enum.Parse<FieldType>(f.Tipo, true);
            var field = await fields.CreateAsync(area, new CreateFieldDefinitionRequest { Code = FullCode(w, f.Codigo), Name = f.Nome, Type = type,
                GlobalOptionsJson = type is FieldType.Select or FieldType.MultiSelect ? JsonSerializer.Serialize(f.Opcoes) : null });
            fieldInputs.Add(new() { FieldDefinitionId = field.Id, ProcessNodeId = nodeIds[f.Etapa], IsRequired = f.Obrigatorio, DisplayOrder = fieldInputs.Count + 1 });
        }
        var start = nodeIds[w.Etapas.Single(n => StageType(n.Tipo) == ProcessNodeType.StartConfection).Codigo];
        var tree = await workflows.CreateAsync(area, new CreateProcessTypeRequest { Code = w.Codigo, Name = w.Nome, Description = w.Descricao, TargetAudience = Audience(w.Publico)!.Value, StartNodeId = start });
        await workflows.UpdateAsync(tree.Id, new UpdateProcessTypeRequest { Name = w.Nome, Description = w.Descricao, TargetAudience = Audience(w.Publico)!.Value, StartNodeId = start,
            Nodes = w.Etapas.Select((n, i) => new ProcessTypeNodeInput { ProcessNodeId = nodeIds[n.Codigo], Order = i + 1 }).ToList(), Fields = fieldInputs,
            Transitions = w.Transicoes.Select(t => new ProcessTransitionInput { FromNodeId = nodeIds[t.Origem], ToNodeId = nodeIds[t.Destino], AllowAdvance = true, AllowReturn = t.PermiteRetorno }).ToList() });
    }
}
