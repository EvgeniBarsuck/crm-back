ALTER TABLE "customers" ADD COLUMN "invite_token" text;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_invite_token_unique" UNIQUE("invite_token");