using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIntegrationTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "integration_tokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: true),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SecurityStamp = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Scopes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_integration_tokens_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "integration_calls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Method = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Route = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    StatusCode = table.Column<int>(type: "integer", nullable: false),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integration_calls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_integration_calls_integration_tokens_TokenId",
                        column: x => x.TokenId,
                        principalTable: "integration_tokens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_integration_calls_TokenId_CreatedAt",
                table: "integration_calls",
                columns: new[] { "TokenId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_integration_calls_UserId_CreatedAt",
                table: "integration_calls",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_integration_tokens_TokenHash",
                table: "integration_tokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_integration_tokens_UserId_CreatedAt",
                table: "integration_tokens",
                columns: new[] { "UserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "integration_calls");

            migrationBuilder.DropTable(
                name: "integration_tokens");
        }
    }
}
