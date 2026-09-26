using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinCore.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFullReviewQueueSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "ReviewQueues",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Device",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FlagReasonsJson",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "ReviewQueues",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "ReviewQueues",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "OriginIp",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PriorityLabel",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "QueueCode",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RecipientId",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RecipientName",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "RiskScore",
                table: "ReviewQueues",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "SenderId",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SenderName",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "ReviewQueues",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Amount",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "Device",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "FlagReasonsJson",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "OriginIp",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "PriorityLabel",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "QueueCode",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "RecipientId",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "RecipientName",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "RiskScore",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "SenderId",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "SenderName",
                table: "ReviewQueues");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "ReviewQueues");
        }
    }
}
