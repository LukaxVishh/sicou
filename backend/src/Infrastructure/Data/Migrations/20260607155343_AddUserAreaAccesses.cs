using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAreaAccesses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_area_accesses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    AreaId = table.Column<Guid>(type: "uuid", nullable: false),
                    CanView = table.Column<bool>(type: "boolean", nullable: false),
                    CanManage = table.Column<bool>(type: "boolean", nullable: false),
                    CanPublishInformatives = table.Column<bool>(type: "boolean", nullable: false),
                    CanManageGuide = table.Column<bool>(type: "boolean", nullable: false),
                    CanManageWorkflows = table.Column<bool>(type: "boolean", nullable: false),
                    CanHandleWorkflowRequests = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_area_accesses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_area_accesses_areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_user_area_accesses_companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_user_area_accesses_units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "units",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_area_accesses_AreaId",
                table: "user_area_accesses",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_user_area_accesses_CompanyId",
                table: "user_area_accesses",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_user_area_accesses_UnitId",
                table: "user_area_accesses",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_user_area_accesses_UserId",
                table: "user_area_accesses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_user_area_accesses_UserId_CompanyId_UnitId_AreaId",
                table: "user_area_accesses",
                columns: new[] { "UserId", "CompanyId", "UnitId", "AreaId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_area_accesses");
        }
    }
}
