DROP INDEX "idx_invoices_number";--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "iva_alicuota" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "iva_incluido" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "created_by" text DEFAULT '—' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "iva" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_number" ON "invoices" USING btree ("store_id","invoice_number");