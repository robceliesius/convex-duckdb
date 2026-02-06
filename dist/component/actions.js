"use node";
import { action } from "./_generated/server.js";
import { api } from "./_generated/api.js";
import { v } from "convex/values";
// Dynamic imports to avoid esbuild trying to bundle native deps at build time
async function getDuckDB() {
    const { Database } = await import("duckdb-async");
    return Database;
}
async function getS3Deps() {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    return { S3Client, PutObjectCommand };
}
const s3ConfigArgs = {
    s3_endpoint: v.string(),
    s3_bucket: v.string(),
    s3_region: v.optional(v.string()),
    s3_access_key_id: v.string(),
    s3_secret_access_key: v.string(),
    s3_force_path_style: v.optional(v.boolean()),
};
async function createS3Client(args) {
    const { S3Client } = await getS3Deps();
    return new S3Client({
        endpoint: args.s3_endpoint,
        region: args.s3_region ?? "us-east-1",
        credentials: {
            accessKeyId: args.s3_access_key_id,
            secretAccessKey: args.s3_secret_access_key,
        },
        forcePathStyle: args.s3_force_path_style ?? true,
    });
}
async function setupDuckDB(args) {
    const Database = await getDuckDB();
    const db = await Database.create(":memory:");
    await db.run("INSTALL httpfs; LOAD httpfs;");
    await db.run(`SET s3_endpoint='${args.s3_endpoint.replace(/^https?:\/\//, "")}';`);
    await db.run(`SET s3_access_key_id='${args.s3_access_key_id}';`);
    await db.run(`SET s3_secret_key='${args.s3_secret_access_key}';`);
    await db.run(`SET s3_region='${args.s3_region ?? "us-east-1"}';`);
    await db.run("SET s3_use_ssl=false;");
    await db.run("SET s3_url_style='path';");
    return db;
}
// Snapshot: take data array, write to Parquet in S3
export const snapshotToS3 = action({
    args: {
        snapshot_id: v.id("snapshots"),
        table_name: v.string(),
        data: v.array(v.any()),
        columns: v.array(v.object({
            source: v.string(),
            target: v.string(),
            type: v.string(),
        })),
        s3_key_prefix: v.string(),
        ...s3ConfigArgs,
    },
    returns: v.object({
        s3_key: v.string(),
        row_count: v.number(),
    }),
    handler: async (ctx, args) => {
        const s3 = await createS3Client(args);
        const { PutObjectCommand } = await getS3Deps();
        const Database = await getDuckDB();
        const timestamp = Date.now();
        const s3Key = `${args.s3_key_prefix}/${timestamp}.parquet`;
        try {
            // Mark as writing
            await ctx.runMutation(api.lib.updateSnapshot, {
                snapshot_id: args.snapshot_id,
                status: "writing",
            });
            // Create DuckDB instance and write data as Parquet
            const db = await Database.create(":memory:");
            // Build column definitions
            const colDefs = args.columns
                .map((c) => `"${c.target}" ${c.type}`)
                .join(", ");
            await db.run(`CREATE TABLE export_data (${colDefs});`);
            // Insert data row by row
            if (args.data.length > 0) {
                const placeholders = args.columns.map(() => "?").join(", ");
                const stmt = await db.prepare(`INSERT INTO export_data VALUES (${placeholders})`);
                for (const row of args.data) {
                    const values = args.columns.map((col) => {
                        const val = row[col.source];
                        return val === undefined ? null : val;
                    });
                    await stmt.run(...values);
                }
                await stmt.finalize();
            }
            // Export to Parquet buffer
            const parquetPath = `/tmp/duckdb_export_${timestamp}.parquet`;
            await db.run(`COPY export_data TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION ZSTD);`);
            await db.close();
            // Read the file and upload to S3
            const fs = await import("fs/promises");
            const buffer = await fs.readFile(parquetPath);
            await s3.send(new PutObjectCommand({
                Bucket: args.s3_bucket,
                Key: s3Key,
                Body: buffer,
                ContentType: "application/octet-stream",
            }));
            // Cleanup temp file
            await fs.unlink(parquetPath).catch(() => { });
            // Mark complete
            await ctx.runMutation(api.lib.updateSnapshot, {
                snapshot_id: args.snapshot_id,
                status: "complete",
                s3_key: s3Key,
                row_count: args.data.length,
            });
            return { s3_key: s3Key, row_count: args.data.length };
        }
        catch (error) {
            await ctx.runMutation(api.lib.updateSnapshot, {
                snapshot_id: args.snapshot_id,
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    },
});
// Chunked snapshot: write a single chunk to S3 as Parquet
export const snapshotChunkToS3 = action({
    args: {
        snapshot_id: v.id("snapshots"),
        table_name: v.string(),
        data: v.array(v.any()),
        columns: v.array(v.object({
            source: v.string(),
            target: v.string(),
            type: v.string(),
        })),
        s3_key_prefix: v.string(),
        chunk_index: v.number(),
        ...s3ConfigArgs,
    },
    returns: v.object({
        s3_key: v.string(),
        row_count: v.number(),
    }),
    handler: async (ctx, args) => {
        const s3 = await createS3Client(args);
        const { PutObjectCommand } = await getS3Deps();
        const Database = await getDuckDB();
        const snapshotDoc = args.snapshot_id.toString();
        const s3Key = `${args.s3_key_prefix}/chunks/${snapshotDoc}/chunk_${String(args.chunk_index).padStart(6, "0")}.parquet`;
        const db = await Database.create(":memory:");
        const colDefs = args.columns
            .map((c) => `"${c.target}" ${c.type}`)
            .join(", ");
        await db.run(`CREATE TABLE chunk_data (${colDefs});`);
        if (args.data.length > 0) {
            const placeholders = args.columns.map(() => "?").join(", ");
            const stmt = await db.prepare(`INSERT INTO chunk_data VALUES (${placeholders})`);
            for (const row of args.data) {
                const values = args.columns.map((col) => {
                    const val = row[col.source];
                    return val === undefined ? null : val;
                });
                await stmt.run(...values);
            }
            await stmt.finalize();
        }
        const parquetPath = `/tmp/duckdb_chunk_${Date.now()}_${args.chunk_index}.parquet`;
        await db.run(`COPY chunk_data TO '${parquetPath}' (FORMAT PARQUET, COMPRESSION ZSTD);`);
        await db.close();
        const fs = await import("fs/promises");
        const buffer = await fs.readFile(parquetPath);
        await s3.send(new PutObjectCommand({
            Bucket: args.s3_bucket,
            Key: s3Key,
            Body: buffer,
            ContentType: "application/octet-stream",
        }));
        await fs.unlink(parquetPath).catch(() => { });
        return { s3_key: s3Key, row_count: args.data.length };
    },
});
// Query: run SQL over Parquet files in S3
export const queryDuckDB = action({
    args: {
        sql: v.string(),
        // Map of table_name -> s3 glob pattern
        table_s3_paths: v.array(v.object({
            table_name: v.string(),
            s3_path: v.string(),
        })),
        ...s3ConfigArgs,
    },
    returns: v.object({
        columns: v.array(v.string()),
        rows: v.array(v.any()),
        row_count: v.number(),
    }),
    handler: async (ctx, args) => {
        const db = await setupDuckDB(args);
        // Create views for each table pointing to S3 Parquet files
        for (const table of args.table_s3_paths) {
            await db.run(`CREATE VIEW "${table.table_name}" AS SELECT * FROM read_parquet('s3://${args.s3_bucket}/${table.s3_path}');`);
        }
        // Execute the user's SQL query
        const result = await db.all(args.sql);
        await db.close();
        const columns = result.length > 0 ? Object.keys(result[0]) : [];
        const rows = result.map((row) => {
            const obj = {};
            for (const col of columns) {
                const val = row[col];
                // Convert BigInt to number for JSON serialization
                obj[col] = typeof val === "bigint" ? Number(val) : val;
            }
            return obj;
        });
        return {
            columns,
            rows,
            row_count: rows.length,
        };
    },
});
//# sourceMappingURL=actions.js.map