using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowModuleEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "field_definitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Placeholder = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    GlobalOptionsJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_field_definitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_field_definitions_areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "process_nodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    NodeType = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_nodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_process_nodes_areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "process_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    TargetAudience = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    StartNodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_types", x => x.Id);
                    table.ForeignKey(
                        name: "FK_process_types_areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_types_process_nodes_StartNodeId",
                        column: x => x.StartNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "process_instances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CreatedByUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OriginUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_instances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_process_instances_areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_instances_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_instances_process_nodes_CurrentNodeId",
                        column: x => x.CurrentNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_instances_process_types_ProcessTypeId",
                        column: x => x.ProcessTypeId,
                        principalTable: "process_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_instances_units_OriginUnitId",
                        column: x => x.OriginUnitId,
                        principalTable: "units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "process_transitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AllowAdvance = table.Column<bool>(type: "boolean", nullable: false),
                    AllowReturn = table.Column<bool>(type: "boolean", nullable: false),
                    AllowRestart = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_transitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_process_transitions_process_nodes_FromNodeId",
                        column: x => x.FromNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_transitions_process_nodes_ToNodeId",
                        column: x => x.ToNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_transitions_process_types_ProcessTypeId",
                        column: x => x.ProcessTypeId,
                        principalTable: "process_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "process_type_fields",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessNodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    FieldDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CustomLabel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    HelpText = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ConditionsJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_type_fields", x => x.Id);
                    table.ForeignKey(
                        name: "FK_process_type_fields_field_definitions_FieldDefinitionId",
                        column: x => x.FieldDefinitionId,
                        principalTable: "field_definitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_type_fields_process_nodes_ProcessNodeId",
                        column: x => x.ProcessNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_type_fields_process_types_ProcessTypeId",
                        column: x => x.ProcessTypeId,
                        principalTable: "process_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "process_type_nodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Instructions = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_type_nodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_process_type_nodes_process_nodes_ProcessNodeId",
                        column: x => x.ProcessNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_type_nodes_process_types_ProcessTypeId",
                        column: x => x.ProcessTypeId,
                        principalTable: "process_types",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "process_field_values",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessInstanceId = table.Column<Guid>(type: "uuid", nullable: false),
                    FieldDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_field_values", x => x.Id);
                    table.ForeignKey(
                        name: "FK_process_field_values_field_definitions_FieldDefinitionId",
                        column: x => x.FieldDefinitionId,
                        principalTable: "field_definitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_field_values_process_instances_ProcessInstanceId",
                        column: x => x.ProcessInstanceId,
                        principalTable: "process_instances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "process_histories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProcessInstanceId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromNodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ToNodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    UserFullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Observations = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_histories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_process_histories_process_instances_ProcessInstanceId",
                        column: x => x.ProcessInstanceId,
                        principalTable: "process_instances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_process_histories_process_nodes_FromNodeId",
                        column: x => x.FromNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_process_histories_process_nodes_ToNodeId",
                        column: x => x.ToNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_field_definitions_AreaId_Code",
                table: "field_definitions",
                columns: new[] { "AreaId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_field_values_FieldDefinitionId",
                table: "process_field_values",
                column: "FieldDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_process_field_values_ProcessInstanceId_FieldDefinitionId",
                table: "process_field_values",
                columns: new[] { "ProcessInstanceId", "FieldDefinitionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_histories_FromNodeId",
                table: "process_histories",
                column: "FromNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_process_histories_ProcessInstanceId_CreatedAt",
                table: "process_histories",
                columns: new[] { "ProcessInstanceId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_process_histories_ToNodeId",
                table: "process_histories",
                column: "ToNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_process_instances_AreaId_Status_CreatedAt",
                table: "process_instances",
                columns: new[] { "AreaId", "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_process_instances_CompanyId_ProcessNumber",
                table: "process_instances",
                columns: new[] { "CompanyId", "ProcessNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_instances_CurrentNodeId",
                table: "process_instances",
                column: "CurrentNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_process_instances_OriginUnitId",
                table: "process_instances",
                column: "OriginUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_process_instances_ProcessTypeId",
                table: "process_instances",
                column: "ProcessTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_process_nodes_AreaId_Code",
                table: "process_nodes",
                columns: new[] { "AreaId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_transitions_FromNodeId",
                table: "process_transitions",
                column: "FromNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_process_transitions_ProcessTypeId_FromNodeId_ToNodeId",
                table: "process_transitions",
                columns: new[] { "ProcessTypeId", "FromNodeId", "ToNodeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_transitions_ToNodeId",
                table: "process_transitions",
                column: "ToNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_process_type_fields_FieldDefinitionId",
                table: "process_type_fields",
                column: "FieldDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_process_type_fields_ProcessNodeId",
                table: "process_type_fields",
                column: "ProcessNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_process_type_fields_ProcessTypeId_FieldDefinitionId_Process~",
                table: "process_type_fields",
                columns: new[] { "ProcessTypeId", "FieldDefinitionId", "ProcessNodeId" });

            migrationBuilder.CreateIndex(
                name: "IX_process_type_nodes_ProcessNodeId",
                table: "process_type_nodes",
                column: "ProcessNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_process_type_nodes_ProcessTypeId_ProcessNodeId",
                table: "process_type_nodes",
                columns: new[] { "ProcessTypeId", "ProcessNodeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_types_AreaId_FamilyId_VersionNumber",
                table: "process_types",
                columns: new[] { "AreaId", "FamilyId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_types_StartNodeId",
                table: "process_types",
                column: "StartNodeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "process_field_values");

            migrationBuilder.DropTable(
                name: "process_histories");

            migrationBuilder.DropTable(
                name: "process_transitions");

            migrationBuilder.DropTable(
                name: "process_type_fields");

            migrationBuilder.DropTable(
                name: "process_type_nodes");

            migrationBuilder.DropTable(
                name: "process_instances");

            migrationBuilder.DropTable(
                name: "field_definitions");

            migrationBuilder.DropTable(
                name: "process_types");

            migrationBuilder.DropTable(
                name: "process_nodes");
        }
    }
}
