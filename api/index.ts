/**
 * Vercel serverless entry point.
 *
 * Imports the Express app from the server module and exports it as the
 * default Vercel serverless function handler. Vercel's @vercel/node runtime
 * handles Express apps natively — no need for serverless-http.
 */
import app from "../server/src/app.js";

export default app;
