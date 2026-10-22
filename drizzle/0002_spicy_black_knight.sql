ALTER TABLE "dishes" ADD COLUMN "content" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "last_updated" timestamp with time zone DEFAULT now() NOT NULL;