import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/cloud-schema.ts",
  out: "./drizzle/cloud",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
