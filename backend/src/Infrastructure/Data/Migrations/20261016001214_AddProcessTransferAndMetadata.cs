using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sicou.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProcessTransferAndMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CurrentUnitId",
                table: "process_instances",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentUnitName",
                table: "process_instances",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OpenedAt",
                table: "process_instances",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OpenedByUserId",
                table: "process_instances",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OpenedByUserName",
                table: "process_instances",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FromUnitId",
                table: "process_histories",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FromUnitName",
                table: "process_histories",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ToUnitId",
                table: "process_histories",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ToUnitName",
                table: "process_histories",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_process_instances_CurrentUnitId",
                table: "process_instances",
                column: "CurrentUnitId");

            migrationBuilder.AddForeignKey(
                name: "FK_process_instances_units_CurrentUnitId",
                table: "process_instances",
                column: "CurrentUnitId",
                principalTable: "units",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_process_instances_units_CurrentUnitId",
                table: "process_instances");

            migrationBuilder.DropIndex(
                name: "IX_process_instances_CurrentUnitId",
                table: "process_instances");

            migrationBuilder.DropColumn(
                name: "CurrentUnitId",
                table: "process_instances");

            migrationBuilder.DropColumn(
                name: "CurrentUnitName",
                table: "process_instances");

            migrationBuilder.DropColumn(
                name: "OpenedAt",
                table: "process_instances");

            migrationBuilder.DropColumn(
                name: "OpenedByUserId",
                table: "process_instances");

            migrationBuilder.DropColumn(
                name: "OpenedByUserName",
                table: "process_instances");

            migrationBuilder.DropColumn(
                name: "FromUnitId",
                table: "process_histories");

            migrationBuilder.DropColumn(
                name: "FromUnitName",
                table: "process_histories");

            migrationBuilder.DropColumn(
                name: "ToUnitId",
                table: "process_histories");

            migrationBuilder.DropColumn(
                name: "ToUnitName",
                table: "process_histories");
        }
    }
}
