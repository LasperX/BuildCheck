CREATE TYPE "public"."user_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."case_side_panel" AS ENUM('glass', 'mesh', 'solid');--> statement-breakpoint
CREATE TYPE "public"."cooler_type" AS ENUM('air', 'aio');--> statement-breakpoint
CREATE TYPE "public"."memory_type" AS ENUM('DDR4', 'DDR5');--> statement-breakpoint
CREATE TYPE "public"."motherboard_form_factor" AS ENUM('ATX', 'mATX', 'ITX', 'EATX');--> statement-breakpoint
CREATE TYPE "public"."psu_efficiency" AS ENUM('White', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Titanium');--> statement-breakpoint
CREATE TYPE "public"."psu_form_factor" AS ENUM('ATX', 'SFX');--> statement-breakpoint
CREATE TYPE "public"."psu_modular" AS ENUM('none', 'semi', 'full');--> statement-breakpoint
CREATE TYPE "public"."storage_interface" AS ENUM('M2', 'SATA');--> statement-breakpoint
CREATE TYPE "public"."storage_type" AS ENUM('NVMe', 'SATA_SSD', 'HDD');--> statement-breakpoint
CREATE TYPE "public"."build_item_condition" AS ENUM('new', 'A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."build_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TYPE "public"."compat_status" AS ENUM('ok', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."usage_type" AS ENUM('gaming', 'office', 'creator', 'streaming');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('comment', 'reply', 'vote', 'fork', 'price_change', 'system', 'price_alert', 'report_reviewed');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'offensive', 'wrong_info', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('build', 'comment', 'user');--> statement-breakpoint
CREATE TYPE "public"."used_grade" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."used_price_confidence" AS ENUM('high', 'medium', 'estimate');--> statement-breakpoint
CREATE TYPE "public"."used_price_source" AS ENUM('reports', 'survey', 'estimate');--> statement-breakpoint
CREATE TYPE "public"."used_report_channel" AS ENUM('facebook', 'marketplace_app', 'shop', 'friend', 'other');--> statement-breakpoint
CREATE TYPE "public"."used_report_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."used_report_type" AS ENUM('listed', 'bought', 'sold');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" varchar(30) NOT NULL,
	"account_id" text NOT NULL,
	"password_hash" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"username" varchar(30),
	"display_username" varchar(30),
	"display_name" varchar(60) NOT NULL,
	"image" text,
	"bio" varchar(300),
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(60) NOT NULL,
	"logo_url" text,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(30) NOT NULL,
	"name_th" varchar(60) NOT NULL,
	"name_en" varchar(60) NOT NULL,
	"icon" varchar(40) NOT NULL,
	"sort_order" integer NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "part_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_id" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"brand_id" integer NOT NULL,
	"model" varchar(150) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"power_watt" integer,
	"image_url" text,
	"release_year" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"spec_source_url" text,
	"spec_verified" boolean DEFAULT false NOT NULL,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "parts_price_non_negative" CHECK ("parts"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "case_specs" (
	"part_id" integer PRIMARY KEY NOT NULL,
	"supported_form_factors" varchar(10)[] NOT NULL,
	"max_gpu_length_mm" smallint NOT NULL,
	"max_cooler_height_mm" smallint NOT NULL,
	"radiator_support_mm" smallint[] DEFAULT ARRAY[]::smallint[] NOT NULL,
	"psu_form_factors" varchar(10)[] NOT NULL,
	"included_fans" smallint DEFAULT 0 NOT NULL,
	"side_panel" "case_side_panel" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cooler_specs" (
	"part_id" integer PRIMARY KEY NOT NULL,
	"type" "cooler_type" NOT NULL,
	"supported_sockets" varchar(20)[] NOT NULL,
	"height_mm" smallint,
	"radiator_mm" smallint,
	"max_tdp_watt" integer NOT NULL,
	CONSTRAINT "cooler_specs_dimension_by_type" CHECK (("cooler_specs"."type" = 'air' AND "cooler_specs"."height_mm" IS NOT NULL) OR ("cooler_specs"."type" = 'aio' AND "cooler_specs"."radiator_mm" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "cpu_specs" (
	"part_id" integer PRIMARY KEY NOT NULL,
	"socket" varchar(20) NOT NULL,
	"generation" varchar(30) NOT NULL,
	"cores" smallint NOT NULL,
	"threads" smallint NOT NULL,
	"base_clock_ghz" numeric(4, 2),
	"boost_clock_ghz" numeric(4, 2),
	"tdp_watt" integer NOT NULL,
	"has_igpu" boolean DEFAULT false NOT NULL,
	"includes_cooler" boolean DEFAULT false NOT NULL,
	"memory_types" varchar(10)[] NOT NULL,
	"perf_score" smallint NOT NULL,
	CONSTRAINT "cpu_specs_perf_score_range" CHECK ("cpu_specs"."perf_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "gpu_specs" (
	"part_id" integer PRIMARY KEY NOT NULL,
	"chipset" varchar(40) NOT NULL,
	"vram_gb" smallint NOT NULL,
	"length_mm" smallint NOT NULL,
	"slot_width" numeric(3, 1),
	"tbp_watt" integer NOT NULL,
	"power_connectors" jsonb NOT NULL,
	"perf_score" smallint NOT NULL,
	CONSTRAINT "gpu_specs_perf_score_range" CHECK ("gpu_specs"."perf_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "motherboard_specs" (
	"part_id" integer PRIMARY KEY NOT NULL,
	"socket" varchar(20) NOT NULL,
	"chipset" varchar(20) NOT NULL,
	"form_factor" "motherboard_form_factor" NOT NULL,
	"memory_type" "memory_type" NOT NULL,
	"memory_slots" smallint NOT NULL,
	"max_memory_gb" smallint NOT NULL,
	"max_memory_speed" integer NOT NULL,
	"m2_slots" smallint NOT NULL,
	"sata_ports" smallint NOT NULL,
	"supported_generations" varchar(30)[] NOT NULL,
	"bios_update_generations" varchar(30)[] DEFAULT ARRAY[]::varchar[] NOT NULL,
	"wifi" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psu_specs" (
	"part_id" integer PRIMARY KEY NOT NULL,
	"wattage" integer NOT NULL,
	"efficiency" "psu_efficiency" NOT NULL,
	"form_factor" "psu_form_factor" NOT NULL,
	"modular" "psu_modular" NOT NULL,
	"pcie_connectors" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ram_specs" (
	"part_id" integer PRIMARY KEY NOT NULL,
	"type" "memory_type" NOT NULL,
	"capacity_per_stick_gb" smallint NOT NULL,
	"sticks_in_kit" smallint NOT NULL,
	"speed_mts" integer NOT NULL,
	"cas_latency" smallint,
	"rgb" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ram_specs_sticks_range" CHECK ("ram_specs"."sticks_in_kit" IN (1, 2))
);
--> statement-breakpoint
CREATE TABLE "storage_specs" (
	"part_id" integer PRIMARY KEY NOT NULL,
	"type" "storage_type" NOT NULL,
	"interface" "storage_interface" NOT NULL,
	"capacity_gb" integer NOT NULL,
	"read_mbps" integer,
	"write_mbps" integer
);
--> statement-breakpoint
CREATE TABLE "build_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"build_id" text NOT NULL,
	"part_id" integer NOT NULL,
	"quantity" smallint DEFAULT 1 NOT NULL,
	"price_at_add" numeric(10, 2) NOT NULL,
	"condition" "build_item_condition" DEFAULT 'new' NOT NULL,
	"offered_price" numeric(10, 2),
	"warranty_months_left" smallint,
	CONSTRAINT "build_items_quantity_positive" CHECK ("build_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "build_votes" (
	"build_id" text NOT NULL,
	"user_id" text NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "build_votes_pk" PRIMARY KEY("build_id","user_id"),
	CONSTRAINT "build_votes_value" CHECK ("build_votes"."value" IN (1, -1))
);
--> statement-breakpoint
CREATE TABLE "builds" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"forked_from_id" text,
	"title" varchar(100) NOT NULL,
	"description" text,
	"usage_type" "usage_type" NOT NULL,
	"budget" numeric(10, 2),
	"visibility" "build_visibility" DEFAULT 'private' NOT NULL,
	"total_price" numeric(10, 2) DEFAULT 0 NOT NULL,
	"total_new_price" numeric(10, 2) DEFAULT 0 NOT NULL,
	"total_watt" integer DEFAULT 0 NOT NULL,
	"perf_score" smallint DEFAULT 0 NOT NULL,
	"compat_status" "compat_status" DEFAULT 'ok' NOT NULL,
	"vote_score" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"build_id" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" integer,
	"body" varchar(1000) NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"build_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_pk" PRIMARY KEY("user_id","build_id")
);
--> statement-breakpoint
CREATE TABLE "admin_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_id" text,
	"action" varchar(40) NOT NULL,
	"target_type" varchar(40),
	"target_id" varchar(40),
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"actor_id" text,
	"build_id" text,
	"message" varchar(255) NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" text,
	"target_type" "report_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"detail" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(60) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_used_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_id" integer NOT NULL,
	"grade" "used_grade" NOT NULL,
	"min_price" numeric(10, 2) NOT NULL,
	"max_price" numeric(10, 2) NOT NULL,
	"surveyed_at" date NOT NULL,
	"source_note" text,
	"updated_by" text,
	CONSTRAINT "part_used_prices_range" CHECK ("part_used_prices"."min_price" <= "part_used_prices"."max_price")
);
--> statement-breakpoint
CREATE TABLE "part_used_stats" (
	"part_id" integer NOT NULL,
	"grade" "used_grade" NOT NULL,
	"median_price" numeric(10, 2) NOT NULL,
	"p25_price" numeric(10, 2),
	"p75_price" numeric(10, 2),
	"report_count" smallint DEFAULT 0 NOT NULL,
	"source" "used_price_source" NOT NULL,
	"confidence" "used_price_confidence" NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "part_used_stats_pk" PRIMARY KEY("part_id","grade")
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"part_id" integer NOT NULL,
	"grade" "used_grade" NOT NULL,
	"target_price" numeric(10, 2) NOT NULL,
	"triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "used_price_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_id" integer NOT NULL,
	"user_id" text,
	"price" numeric(10, 2) NOT NULL,
	"grade" "used_grade" NOT NULL,
	"report_type" "used_report_type" NOT NULL,
	"channel" "used_report_channel" NOT NULL,
	"province" varchar(40),
	"warranty_months_left" smallint DEFAULT 0 NOT NULL,
	"seen_at" date NOT NULL,
	"proof_image_url" text,
	"status" "used_report_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "used_price_reports_price_positive" CHECK ("used_price_reports"."price" > 0)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_price_history" ADD CONSTRAINT "part_price_history_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_price_history" ADD CONSTRAINT "part_price_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_specs" ADD CONSTRAINT "case_specs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooler_specs" ADD CONSTRAINT "cooler_specs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpu_specs" ADD CONSTRAINT "cpu_specs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpu_specs" ADD CONSTRAINT "gpu_specs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motherboard_specs" ADD CONSTRAINT "motherboard_specs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psu_specs" ADD CONSTRAINT "psu_specs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ram_specs" ADD CONSTRAINT "ram_specs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_specs" ADD CONSTRAINT "storage_specs_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_votes" ADD CONSTRAINT "build_votes_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_votes" ADD CONSTRAINT "build_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builds" ADD CONSTRAINT "builds_forked_from_id_builds_id_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."builds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_build_id_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."builds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_used_prices" ADD CONSTRAINT "part_used_prices_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_used_prices" ADD CONSTRAINT "part_used_prices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_used_stats" ADD CONSTRAINT "part_used_stats_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "used_price_reports" ADD CONSTRAINT "used_price_reports_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "used_price_reports" ADD CONSTRAINT "used_price_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "used_price_reports" ADD CONSTRAINT "used_price_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "part_price_history_part_idx" ON "part_price_history" USING btree ("part_id","changed_at");--> statement-breakpoint
CREATE INDEX "parts_category_active_price_idx" ON "parts" USING btree ("category_id","is_active","price");--> statement-breakpoint
CREATE INDEX "parts_search_vector_idx" ON "parts" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "cpu_specs_socket_idx" ON "cpu_specs" USING btree ("socket");--> statement-breakpoint
CREATE INDEX "motherboard_specs_socket_idx" ON "motherboard_specs" USING btree ("socket");--> statement-breakpoint
CREATE INDEX "ram_specs_type_idx" ON "ram_specs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "build_items_build_idx" ON "build_items" USING btree ("build_id");--> statement-breakpoint
CREATE INDEX "build_items_part_idx" ON "build_items" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "builds_visibility_votes_idx" ON "builds" USING btree ("visibility","vote_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "builds_visibility_created_idx" ON "builds" USING btree ("visibility","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "builds_user_idx" ON "builds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_build_idx" ON "comments" USING btree ("build_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_logs_admin_created_idx" ON "admin_logs" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "part_used_prices_part_grade_idx" ON "part_used_prices" USING btree ("part_id","grade","surveyed_at");--> statement-breakpoint
CREATE INDEX "price_alerts_part_grade_idx" ON "price_alerts" USING btree ("part_id","grade","triggered_at");--> statement-breakpoint
CREATE INDEX "used_price_reports_calc_idx" ON "used_price_reports" USING btree ("part_id","grade","status","seen_at");