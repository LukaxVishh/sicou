using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260910100000_AddCorporatePosts")]
public partial class AddCorporatePosts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "posts",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                AuthorId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                Content = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                IsPinned = table.Column<bool>(type: "boolean", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                IsActive = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_posts", x => x.Id);
                table.ForeignKey(
                    name: "FK_posts_companies_CompanyId",
                    column: x => x.CompanyId,
                    principalTable: "companies",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_posts_AuthorId",
            table: "posts",
            column: "AuthorId");

        migrationBuilder.CreateIndex(
            name: "IX_posts_CompanyId_IsActive_IsPinned_CreatedAt",
            table: "posts",
            columns: new[] { "CompanyId", "IsActive", "IsPinned", "CreatedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "posts");
    }
}
