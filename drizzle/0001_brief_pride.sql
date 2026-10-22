CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "images_location_unique" UNIQUE("location")
);
--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "image_id" uuid;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;