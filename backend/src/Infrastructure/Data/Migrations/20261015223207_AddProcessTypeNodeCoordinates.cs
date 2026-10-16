using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProcessTypeNodeCoordinates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "CoordinateX",
                table: "process_type_nodes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "CoordinateY",
                table: "process_type_nodes",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CoordinateX",
                table: "process_type_nodes");

            migrationBuilder.DropColumn(
                name: "CoordinateY",
                table: "process_type_nodes");
        }
    }
}
