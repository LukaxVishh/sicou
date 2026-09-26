using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Sicou.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260926120000_AddGuideModule")]
public class AddGuideModule : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE guide_categories (
                "Id" uuid NOT NULL CONSTRAINT "PK_guide_categories" PRIMARY KEY,
                "AreaId" uuid NOT NULL,
                "Name" character varying(150) NOT NULL,
                "SortOrder" integer NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "IsActive" boolean NOT NULL,
                CONSTRAINT "AK_guide_categories_Id_AreaId" UNIQUE ("Id", "AreaId"),
                CONSTRAINT "FK_guide_categories_areas_AreaId" FOREIGN KEY ("AreaId") REFERENCES areas ("Id") ON DELETE CASCADE
            );
            CREATE INDEX "IX_guide_categories_AreaId_SortOrder" ON guide_categories ("AreaId", "SortOrder");
            CREATE TABLE guide_items (
                "Id" uuid NOT NULL CONSTRAINT "PK_guide_items" PRIMARY KEY,
                "AreaId" uuid NOT NULL,
                "CategoryId" uuid NOT NULL,
                "Title" character varying(200) NOT NULL,
                "Content" character varying(50000) NOT NULL,
                "Url" character varying(2048) NULL,
                "SortOrder" integer NOT NULL,
                "IsPublished" boolean NOT NULL,
                "FileName" character varying(255) NULL,
                "FileData" bytea NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "IsActive" boolean NOT NULL,
                CONSTRAINT "FK_guide_items_guide_categories_CategoryId_AreaId" FOREIGN KEY ("CategoryId", "AreaId")
                    REFERENCES guide_categories ("Id", "AreaId") ON DELETE RESTRICT
            );
            CREATE INDEX "IX_guide_items_AreaId_IsPublished_SortOrder" ON guide_items ("AreaId", "IsPublished", "SortOrder");
            CREATE INDEX "IX_guide_items_CategoryId_AreaId" ON guide_items ("CategoryId", "AreaId");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("guide_items");
        migrationBuilder.DropTable("guide_categories");
    }
}