using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AlignAutomationMonitoringWithTcc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalSystem",
                table: "integration_tokens",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "DurationAlertedAt",
                table: "automation_runs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Logs",
                table: "automation_runs",
                type: "character varying(16000)",
                maxLength: 16000,
                nullable: true);
            migrationBuilder.Sql("UPDATE integration_tokens SET \"ExternalSystem\" = \"Name\" WHERE \"ExternalSystem\" = '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalSystem",
                table: "integration_tokens");

            migrationBuilder.DropColumn(
                name: "DurationAlertedAt",
                table: "automation_runs");

            migrationBuilder.DropColumn(
                name: "Logs",
                table: "automation_runs");
        }
    }
}
