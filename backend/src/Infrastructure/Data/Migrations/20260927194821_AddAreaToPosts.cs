using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAreaToPosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_posts_CompanyId_IsActive_IsPinned_CreatedAt",
                table: "posts");

            migrationBuilder.AddColumn<Guid>(
                name: "AreaId",
                table: "posts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_posts_AreaId",
                table: "posts",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_posts_CompanyId_AreaId_IsActive_IsPinned_CreatedAt",
                table: "posts",
                columns: new[] { "CompanyId", "AreaId", "IsActive", "IsPinned", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_posts_areas_AreaId",
                table: "posts",
                column: "AreaId",
                principalTable: "areas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_posts_areas_AreaId",
                table: "posts");

            migrationBuilder.DropIndex(
                name: "IX_posts_AreaId",
                table: "posts");

            migrationBuilder.DropIndex(
                name: "IX_posts_CompanyId_AreaId_IsActive_IsPinned_CreatedAt",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "AreaId",
                table: "posts");

            migrationBuilder.CreateIndex(
                name: "IX_posts_CompanyId_IsActive_IsPinned_CreatedAt",
                table: "posts",
                columns: new[] { "CompanyId", "IsActive", "IsPinned", "CreatedAt" });
        }
    }
}
