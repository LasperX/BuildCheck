CREATE TYPE "public"."part_availability" AS ENUM('new', 'used_only');--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "availability" "part_availability" DEFAULT 'new' NOT NULL;