ALTER TABLE "sales" ADD COLUMN "subtotal" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_percent" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "discount_amount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "cash_amount" double precision;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "card_amount" double precision;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "mercadopago_amount" double precision;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;