# @robceliesius/convex-duckdb

DuckDB-powered SQL analytics for Convex apps.

Export Convex data to Parquet in S3/MinIO, then run DuckDB SQL over those Parquet files without touching your production database.

## How It Works

```
Your Convex App
  │
  ├─ Component (metadata)    Tracks table registrations & snapshot history
  │     stored in Convex
  │
  └─ DuckDB Sidecar (HTTP)   Converts data → Parquet, uploads to S3,
        runs SQL queries       executes SQL over Parquet files
        over Parquet in S3
```

**The component handles metadata** (table registrations, column mappings, snapshot history).

**The sidecar handles the heavy lifting** (Parquet serialization, S3/MinIO uploads, DuckDB query execution).

This split is intentional: DuckDB is a native dependency and should not run inside Convex UDFs.

## Installation

```bash
npm install @robceliesius/convex-duckdb
```

## Setup

### 1. Register the component (Convex plugin)

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import duckdb from "@robceliesius/convex-duckdb/convex.config";

const app = defineApp();
app.use(duckdb);
export default app;
```

This makes the component API available at `components.duckdb` (via Convex codegen).

### 2. Run the DuckDB sidecar (HTTP service)

The sidecar is a lightweight Node.js service that runs alongside your app. See [`convex-duckdb-sidecar`](https://github.com/robceliesius/convex-duckdb-sidecar) for the Docker image, or run it directly:

```bash
cd duckdb-sidecar
npm install && npm run build
PORT=3214 node dist/server.js
```

**Important (Docker base image):** DuckDB uses native bindings. Alpine-based images frequently fail to load DuckDB (`ERR_DLOPEN_FAILED` / missing `ld-linux-*`). Prefer a glibc-based base image (Debian/Ubuntu), e.g. `node:*-bookworm-slim`.

Docker Compose example:

```yaml
duckdb-sidecar:
  build: ./duckdb-sidecar
  ports:
    - "3214:3214"
  depends_on:
    - minio
```

### 3. Configure runtime environment (Convex env)

`DuckDBClient` runs inside `"use node"` Convex code and calls:
- the sidecar over HTTP (`DUCKDB_SIDECAR_URL`)
- S3/MinIO via DuckDB `httpfs` (`S3_ENDPOINT_URL`, credentials, bucket)

Set these as **Convex environment variables** (recommended) so they're available to Node UDFs:
- `DUCKDB_SIDECAR_URL`
- `S3_ENDPOINT_URL`
- `ANALYTICS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

Example:

```bash
npx convex env set DUCKDB_SIDECAR_URL "http://duckdb-sidecar:3214"
npx convex env set S3_ENDPOINT_URL "http://minio:9000"
npx convex env set ANALYTICS_S3_BUCKET "analytics-parquet"
npx convex env set AWS_ACCESS_KEY_ID "minioadmin"
npx convex env set AWS_SECRET_ACCESS_KEY "minioadmin"
npx convex env set AWS_REGION "us-east-1"
```

### 4. Create a client (in a `"use node"` file)

```typescript
// convex/analytics/client.ts
"use node";

import { DuckDBClient } from "@robceliesius/convex-duckdb";
import { components } from "../_generated/api";

export function getAnalyticsClient() {
  return new DuckDBClient(
    components.duckdb,
    process.env.DUCKDB_SIDECAR_URL ?? "http://localhost:3214",
    {
      endpoint: process.env.S3_ENDPOINT_URL ?? "http://minio:9000",
      bucket: process.env.ANALYTICS_S3_BUCKET ?? "analytics",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      forcePathStyle: true, // Required for MinIO
    },
    // Optional: Abort sidecar requests that take too long (defaults to 120s).
    { timeoutMs: 120_000 },
  );
}
```

### Sidecar timeouts

`DuckDBClient` calls the sidecar over HTTP from `"use node"` Convex code. By default, it applies a **120 second** timeout to both `/snapshot` and `/query` requests to avoid hanging UDFs.

You can override this per operation:

```ts
new DuckDBClient(component, sidecarURL, s3Config, {
  snapshotTimeoutMs: 300_000,
  queryTimeoutMs: 30_000,
});
```

## Troubleshooting

### Sidecar URL must be reachable from Node UDFs

`DuckDBClient.snapshot()` and `DuckDBClient.query()` run inside `"use node"` Convex code and call the sidecar over HTTP.

That means `DUCKDB_SIDECAR_URL` must be reachable from the Convex Node UDF runtime.

Common pitfalls:
- Docker-only hostnames like `http://duckdb-sidecar:3214` may not resolve from the UDF runtime, depending on how you self-host Convex.
- Custom hostnames and `host.docker.internal` can resolve differently between your laptop, Docker containers, and the UDF runtime.

If you see `fetch failed`, validate reachability from the environment that actually runs the Node UDFs.

In practice, this means:
- if your UDFs run in Docker/Kubernetes, use a URL resolvable/reachable there (service DNS, cluster IP, etc.)
- for local dev, prefer a stable IP/hostname that your Convex backend can reach (not necessarily the same hostname you use on your laptop)

### MinIO hostname collisions on shared Docker networks

If you have multiple MinIO containers on the same Docker network and they share aliases like `minio`, DNS can resolve to the "wrong" MinIO.

Symptoms:
- Snapshots appear to upload successfully, but queries fail with `404 (Not Found)` for the Parquet URL.

Fixes:
- Use an unambiguous `S3_ENDPOINT_URL` (specific container name) instead of `http://minio:9000`.
- Or ensure only one MinIO advertises the alias you use.

### DuckDB S3 settings

DuckDB's `httpfs` extension expects the secret key setting name `s3_secret_access_key` (not `s3_secret_key`).

## Usage

### Register a table

Define which Convex tables to export and how fields map to Parquet columns:

```typescript
const client = getAnalyticsClient();

await client.registerTable(ctx, {
  tableName: "orders",
  columns: [
    { source: "_id",        target: "_id",        type: "VARCHAR" },
    { source: "customer",   target: "customer",   type: "VARCHAR" },
    { source: "total",      target: "total",      type: "DOUBLE"  },
    { source: "created_at", target: "created_at", type: "BIGINT"  },
    { source: "status",     target: "status",     type: "VARCHAR" },
  ],
  s3KeyPrefix: "tenant_123/orders",
});
```

## API

Constructor:

```ts
new DuckDBClient(component, sidecarURL, s3Config, opts?)
```

Where `opts` is:

```ts
{
  timeoutMs?: number;
  snapshotTimeoutMs?: number;
  queryTimeoutMs?: number;
}
```

### Snapshot data to Parquet

Fetch your data however you like, then pass it to `snapshot()`. The sidecar converts it to Parquet with ZSTD compression and uploads to S3:

```typescript
const allOrders = await ctx.runQuery(internal.orders.listAll);

const result = await client.snapshot(ctx, {
  tableName: "orders",
  data: allOrders,
});

// result: { s3Key: "tenant_123/orders/1706140800000.parquet", rowCount: 5432, parquetSizeBytes: 28410 }
```

### Typical pattern: snapshot on a schedule

This component does not auto-export your tables. You decide when to snapshot.

Common approaches:
- cron job / scheduled action: snapshot once per hour/day per tenant
- on-demand: snapshot after a bulk import, ETL run, or data migration

### Query with SQL

Write standard SQL. The client resolves table names to their latest Parquet snapshots in S3 automatically:

```typescript
const result = await client.query(ctx, {
  sql: `
    SELECT
      customer,
      COUNT(*) as order_count,
      SUM(total) as revenue,
      AVG(total) as avg_order
    FROM orders
    WHERE created_at >= 1704067200000
      AND status = 'completed'
    GROUP BY customer
    ORDER BY revenue DESC
    LIMIT 20
  `,
  tableNames: ["orders"],
});

// result: { columns: ["customer", "order_count", "revenue", "avg_order"], rows: [...], row_count: 20 }
```

You get the full power of DuckDB SQL — window functions, CTEs, JOINs across tables, aggregations:

```typescript
const result = await client.query(ctx, {
  sql: `
    WITH monthly AS (
      SELECT
        DATE_TRUNC('month', EPOCH_MS(created_at)) as month,
        SUM(total) as revenue
      FROM orders
      WHERE status = 'completed'
      GROUP BY 1
    )
    SELECT
      month,
      revenue,
      revenue - LAG(revenue) OVER (ORDER BY month) as growth
    FROM monthly
    ORDER BY month
  `,
  tableNames: ["orders"],
});
```

### Snapshot management

```typescript
// Get latest snapshot metadata
const snapshot = await client.getLatestSnapshot(ctx, "orders");
// { status: "complete", s3_key: "...", row_count: 5432, created_at: 1706140800000 }

// List recent snapshots
const history = await client.listSnapshots(ctx, {
  tableName: "orders",
  limit: 10,
});
```

## API Reference

### `DuckDBClient`

```typescript
new DuckDBClient(component, sidecarURL, s3Config)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `component` | `ComponentApi` | The `components.duckdb` reference from Convex codegen |
| `sidecarURL` | `string` | URL of the DuckDB sidecar service |
| `s3Config` | `S3Config` | S3/MinIO connection details |

#### `S3Config`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `endpoint` | `string` | *required* | S3 endpoint URL |
| `bucket` | `string` | *required* | Bucket name for Parquet files |
| `region` | `string` | `"us-east-1"` | AWS region |
| `accessKeyId` | `string` | *required* | S3 access key |
| `secretAccessKey` | `string` | *required* | S3 secret key |
| `forcePathStyle` | `boolean` | `true` | Use path-style URLs (required for MinIO) |

### Methods

| Method | Context Required | Description |
|--------|-----------------|-------------|
| `registerTable(ctx, args)` | `runMutation` | Register a table with column mappings |
| `getRegisteredTable(ctx, name)` | `runQuery` | Get a table's configuration |
| `listRegisteredTables(ctx)` | `runQuery` | List all registered tables |
| `snapshot(ctx, args)` | `runQuery` + `runMutation` | Export data as Parquet to S3 |
| `query(ctx, args)` | `runQuery` | Run SQL over Parquet snapshots |
| `getLatestSnapshot(ctx, name)` | `runQuery` | Get latest snapshot metadata |
| `listSnapshots(ctx, args)` | `runQuery` | List snapshot history |

### Column Types

| Type | DuckDB Type | Use For |
|------|-------------|---------|
| `VARCHAR` | `VARCHAR` | Strings, IDs |
| `INTEGER` | `INTEGER` | 32-bit integers |
| `BIGINT` | `BIGINT` | 64-bit integers, timestamps (ms) |
| `DOUBLE` | `DOUBLE` | Floating point numbers |
| `BOOLEAN` | `BOOLEAN` | True/false values |

## Sidecar Endpoints

The DuckDB sidecar exposes three endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | `GET` | Health check — returns `{ status: "ok" }` |
| `/snapshot` | `POST` | Write data as Parquet to S3 |
| `/query` | `POST` | Execute SQL over Parquet files in S3 |

### `POST /snapshot`

```json
{
  "table_name": "orders",
  "data": [{ "_id": "abc", "total": 99.99 }],
  "columns": [{ "source": "_id", "target": "_id", "type": "VARCHAR" }],
  "s3_key": "tenant/orders/1706140800000.parquet",
  "s3_config": { "endpoint": "http://minio:9000", "bucket": "analytics", "accessKeyId": "...", "secretAccessKey": "...", "forcePathStyle": true }
}
```

### `POST /query`

```json
{
  "sql": "SELECT COUNT(*) as total FROM orders",
  "tables": [{ "name": "orders", "s3_path": "tenant/orders/1706140800000.parquet" }],
  "s3_config": { "endpoint": "http://minio:9000", "bucket": "analytics", "accessKeyId": "...", "secretAccessKey": "...", "forcePathStyle": true }
}
```

## Architecture Decisions

**Why a sidecar instead of in-process?**
Convex components cannot use `"use node"` directives or native Node.js dependencies. DuckDB requires native binaries (`node-pre-gyp`). The sidecar pattern keeps the component pure (metadata only) while offloading compute to a service that can use any dependencies.

**Why Parquet?**
Parquet is a columnar format optimized for analytical queries. DuckDB reads it natively with zero-copy, and ZSTD compression typically achieves 5-10x reduction vs JSON. A 50MB JSON dataset becomes ~5MB in Parquet.

**Why per-request DuckDB instances?**
Each sidecar request creates a fresh `:memory:` DuckDB instance and disposes it after. This ensures complete isolation between requests, prevents state leaks, and simplifies error handling. DuckDB startup is ~10ms so the overhead is negligible.

**Why S3/MinIO?**
Parquet files in object storage decouple compute from storage. You can query the same data from multiple services, retain historical snapshots cheaply, and avoid storing large analytical datasets in your Convex database.

## Requirements

- Convex `^1.24.0`
- Node.js 22+ (for the sidecar)
- S3-compatible object storage (MinIO, AWS S3, etc.)

## Related

- [`convex-duckdb-sidecar`](https://github.com/robceliesius/convex-duckdb-sidecar) — The DuckDB HTTP sidecar service (deployment, Docker, endpoints)

## License

MIT
