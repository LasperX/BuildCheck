DROP INDEX "builds_visibility_votes_idx";--> statement-breakpoint
DROP INDEX "builds_visibility_created_idx";--> statement-breakpoint
CREATE INDEX "builds_visibility_votes_idx" ON "builds" USING btree ("visibility","vote_score" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "builds_visibility_created_idx" ON "builds" USING btree ("visibility","created_at" DESC NULLS FIRST);