using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260910110000_MakePostsGlobal")]
public partial class MakePostsGlobal : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<Guid>(
            name: "CompanyId",
            table: "posts",
            type: "uuid",
            nullable: true,
            oldClrType: typeof(Guid),
            oldType: "uuid");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DELETE FROM posts WHERE \"CompanyId\" IS NULL;");

        migrationBuilder.AlterColumn<Guid>(
            name: "CompanyId",
            table: "posts",
            type: "uuid",
            nullable: false,
            oldClrType: typeof(Guid),
            oldType: "uuid",
            oldNullable: true);
    }
}
