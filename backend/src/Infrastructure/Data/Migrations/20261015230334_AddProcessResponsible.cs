using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProcessResponsible : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ResponsibleUserId",
                table: "process_instances",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_instances_CompanyId_CreatedAt",
                table: "process_instances",
                columns: new[] { "CompanyId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_process_instances_ResponsibleUserId",
                table: "process_instances",
                column: "ResponsibleUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_process_instances_users_ResponsibleUserId",
                table: "process_instances",
                column: "ResponsibleUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_process_instances_users_ResponsibleUserId",
                table: "process_instances");

            migrationBuilder.DropIndex(
                name: "IX_process_instances_CompanyId_CreatedAt",
                table: "process_instances");

            migrationBuilder.DropIndex(
                name: "IX_process_instances_ResponsibleUserId",
                table: "process_instances");

            migrationBuilder.DropColumn(
                name: "ResponsibleUserId",
                table: "process_instances");
        }
    }
}
