/**
 * Example: Using @robceliesius/convex-duckdb in a Convex app
 *
 * 1. Install: npm install @robceliesius/convex-duckdb
 *
 * 2. In your convex.config.ts:
 *    import { defineApp } from "convex/server";
 *    import duckdb from "@robceliesius/convex-duckdb/convex.config";
 *    const app = defineApp();
 *    app.use(duckdb);
 *    export default app;
 *
 * 3. Use in your functions:
 */

import { DuckDB } from "@robceliesius/convex-duckdb";
// import { components } from "./_generated/api";
// import { internal } from "./_generated/api";

// Initialize with your S3/Minio config
const analytics = new DuckDB({} as any /* components.duckdb */, {
  endpoint: "http://minio:9000",
  bucket: "analytics",
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",
  forcePathStyle: true,
});

// --- Example 1: Register a table ---
async function registerProductionJobs(ctx: any) {
  await analytics.registerTable(ctx, {
    tableName: "production_jobs",
    columns: [
      { source: "job_number", target: "job_number", type: "VARCHAR" },
      { source: "status", target: "status", type: "VARCHAR" },
      { source: "quantity", target: "quantity", type: "INTEGER" },
      { source: "_creationTime", target: "created_at", type: "DOUBLE" },
    ],
  });
}

// --- Example 2: Simple snapshot (small tables) ---
async function snapshotJobs(ctx: any) {
  // Consumer fetches their own data
  // const jobs = await ctx.runQuery(internal.jobs.allForExport, {});
  const jobs = [
    { job_number: "J-001", status: "complete", quantity: 100, _creationTime: Date.now() },
    { job_number: "J-002", status: "in_progress", quantity: 50, _creationTime: Date.now() },
  ];

  await analytics.snapshot(ctx, {
    tableName: "production_jobs",
    data: jobs,
  });
}

// --- Example 3: Chunked snapshot (large tables) ---
async function snapshotLargeTable(ctx: any) {
  const chunked = await analytics.startSnapshot(ctx, "production_jobs");

  // Paginate through your data
  let cursor = null;
  let isDone = false;
  while (!isDone) {
    // const page = await ctx.runQuery(internal.jobs.paginatedExport, { cursor });
    const page = { data: [{ job_number: "J-001", status: "complete", quantity: 100 }], cursor: "next", isDone: true };
    await chunked.appendChunk(ctx, page.data);
    cursor = page.cursor;
    isDone = page.isDone;
  }

  await chunked.finalize(ctx);
}

// --- Example 4: SQL query ---
async function queryAnalytics(ctx: any) {
  const result = await analytics.query(ctx, {
    sql: `
      SELECT status, COUNT(*) as count, SUM(quantity) as total_qty
      FROM production_jobs
      GROUP BY status
      ORDER BY count DESC
    `,
  });

  console.log(result.columns); // ["status", "count", "total_qty"]
  console.log(result.rows);    // [{ status: "complete", count: 42, total_qty: 5000 }, ...]
}

// --- Example 5: Query specific tables ---
async function crossTableQuery(ctx: any) {
  const result = await analytics.query(ctx, {
    sql: `
      SELECT j.status, COUNT(*) as job_count
      FROM production_jobs j
      GROUP BY j.status
    `,
    tableNames: ["production_jobs"],
  });
  return result;
}
