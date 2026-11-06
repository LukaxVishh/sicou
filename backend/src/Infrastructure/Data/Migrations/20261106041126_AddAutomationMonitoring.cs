using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAutomationMonitoring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "automations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    HeartbeatTimeoutSeconds = table.Column<int>(type: "integer", nullable: false),
                    MaxRunMinutes = table.Column<int>(type: "integer", nullable: false),
                    ExpectedIntervalMinutes = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ScheduleBaselineAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OverdueAlertedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_automations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_automations_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "automation_runs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AutomationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExternalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Host = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastHeartbeatAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExitCode = table.Column<int>(type: "integer", nullable: true),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    HeartbeatTimeoutSeconds = table.Column<int>(type: "integer", nullable: false),
                    MaxRunMinutes = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_automation_runs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_automation_runs_automations_AutomationId",
                        column: x => x.AutomationId,
                        principalTable: "automations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "automation_alerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AutomationId = table.Column<Guid>(type: "uuid", nullable: false),
                    RunId = table.Column<Guid>(type: "uuid", nullable: true),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Message = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcknowledgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_automation_alerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_automation_alerts_automation_runs_RunId",
                        column: x => x.RunId,
                        principalTable: "automation_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_automation_alerts_automations_AutomationId",
                        column: x => x.AutomationId,
                        principalTable: "automations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_automation_alerts_AutomationId_CreatedAt",
                table: "automation_alerts",
                columns: new[] { "AutomationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_automation_alerts_RunId",
                table: "automation_alerts",
                column: "RunId");

            migrationBuilder.CreateIndex(
                name: "IX_automation_runs_AutomationId_ExternalId",
                table: "automation_runs",
                columns: new[] { "AutomationId", "ExternalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_automation_runs_AutomationId_StartedAt",
                table: "automation_runs",
                columns: new[] { "AutomationId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_automation_runs_Status_LastHeartbeatAt",
                table: "automation_runs",
                columns: new[] { "Status", "LastHeartbeatAt" });

            migrationBuilder.CreateIndex(
                name: "IX_automations_CompanyId_UserId_CreatedAt",
                table: "automations",
                columns: new[] { "CompanyId", "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_automations_UserId",
                table: "automations",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "automation_alerts");

            migrationBuilder.DropTable(
                name: "automation_runs");

            migrationBuilder.DropTable(
                name: "automations");
        }
    }
}
