using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProcessNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_process_nodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    ProcessNodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_process_nodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_process_nodes_process_nodes_ProcessNodeId",
                        column: x => x.ProcessNodeId,
                        principalTable: "process_nodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_process_nodes_ProcessNodeId",
                table: "user_process_nodes",
                column: "ProcessNodeId");

            migrationBuilder.CreateIndex(
                name: "IX_user_process_nodes_UserId",
                table: "user_process_nodes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_user_process_nodes_UserId_ProcessNodeId",
                table: "user_process_nodes",
                columns: new[] { "UserId", "ProcessNodeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_process_nodes");
        }
    }
}
