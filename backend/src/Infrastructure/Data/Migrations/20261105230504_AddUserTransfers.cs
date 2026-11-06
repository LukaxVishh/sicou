using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTransfers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_transfers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromCompanyId = table.Column<Guid>(type: "uuid", nullable: true),
                    FromCompanyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    FromUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    FromUnitName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ToCompanyId = table.Column<Guid>(type: "uuid", nullable: true),
                    ToCompanyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ToUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    ToUnitName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PerformedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PerformedByName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CopyAccessesRequested = table.Column<bool>(type: "boolean", nullable: false),
                    RevokedAreaAccesses = table.Column<int>(type: "integer", nullable: false),
                    CopiedAreaAccesses = table.Column<int>(type: "integer", nullable: false),
                    RevokedProcessNodes = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_transfers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_transfers_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_transfers_UserId_CreatedAt",
                table: "user_transfers",
                columns: new[] { "UserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_transfers");
        }
    }
}
