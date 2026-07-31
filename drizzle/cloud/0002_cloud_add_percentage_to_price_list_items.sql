ALTER TABLE "price_list_items" ADD COLUMN "percentage" double precision;
ALTER TABLE "price_list_items" ALTER COLUMN "price" DROP NOT NULL;
