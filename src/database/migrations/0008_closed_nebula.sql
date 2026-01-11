CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_merchants_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;