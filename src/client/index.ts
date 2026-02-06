import type {
  GenericMutationCtx,
  GenericDataModel,
  GenericQueryCtx,
} from "convex/server";

// Type for the component API - will be refined after codegen
type ComponentApi = any;

type RunQueryCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
};

type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};

type MetadataCtx = RunQueryCtx & RunMutationCtx;

export type S3Config = {
  endpoint: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

export type ColumnMapping = {
  source: string;
  target: string;
  type: string;
};

export type QueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
};

export type DuckDBClientOptions = {
  /**
   * Default timeout for sidecar HTTP requests (ms). Used if per-operation
   * timeouts are not provided.
   */
  timeoutMs?: number;
  /** Timeout for snapshot requests (ms). Overrides `timeoutMs` when set. */
  snapshotTimeoutMs?: number;
  /** Timeout for query requests (ms). Overrides `timeoutMs` when set. */
  queryTimeoutMs?: number;
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  // Node 18+ supports AbortController. If unavailable, we still perform the
  // request without a timeout.
  const AbortControllerAny = (globalThis as any).AbortController as
    | (new () => AbortController)
    | undefined;
  if (!AbortControllerAny || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await fetch(url, init);
  }

  const controller = new AbortControllerAny();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("aborted") ||
      msg.includes("AbortError") ||
      // Undici sometimes throws with this code.
      (err as any)?.name === "AbortError"
    ) {
      throw new Error(`Sidecar request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class DuckDBClient {
  private component: ComponentApi;
  private sidecarURL: string;
  private s3Config: S3Config;
  private snapshotTimeoutMs: number;
  private queryTimeoutMs: number;

  constructor(
    component: ComponentApi,
    sidecarURL: string,
    s3Config: S3Config,
    opts?: DuckDBClientOptions,
  ) {
    this.component = component;
    this.sidecarURL = sidecarURL.replace(/\/$/, "");
    this.s3Config = s3Config;

    const defaultTimeoutMs = opts?.timeoutMs ?? 120_000;
    this.snapshotTimeoutMs = opts?.snapshotTimeoutMs ?? defaultTimeoutMs;
    this.queryTimeoutMs = opts?.queryTimeoutMs ?? defaultTimeoutMs;
  }

  /**
   * Register a table for analytics export with column mappings.
   */
  async registerTable(
    ctx: RunMutationCtx,
    args: {
      tableName: string;
      columns: ColumnMapping[];
      s3KeyPrefix?: string;
    },
  ): Promise<void> {
    await ctx.runMutation(this.component.lib.registerTable, {
      table_name: args.tableName,
      columns: args.columns,
      s3_key_prefix: args.s3KeyPrefix,
    });
  }

  /**
   * Get a registered table's configuration.
   */
  async getRegisteredTable(ctx: RunQueryCtx, tableName: string) {
    return await ctx.runQuery(this.component.lib.getRegisteredTable, {
      table_name: tableName,
    });
  }

  /**
   * List all registered tables.
   */
  async listRegisteredTables(ctx: RunQueryCtx) {
    return await ctx.runQuery(this.component.lib.listRegisteredTables, {});
  }

  /**
   * Snapshot data to S3 as Parquet via the sidecar service.
   * Consumer fetches their own data and passes it here.
   */
  async snapshot(
    ctx: MetadataCtx,
    args: {
      tableName: string;
      data: Record<string, unknown>[];
    },
  ): Promise<{ s3Key: string; rowCount: number; parquetSizeBytes: number }> {
    // Get table config
    const table = await ctx.runQuery(this.component.lib.getRegisteredTable, {
      table_name: args.tableName,
    });
    if (!table) {
      throw new Error(`Table "${args.tableName}" is not registered`);
    }

    // Create snapshot record
    const snapshotId = await ctx.runMutation(
      this.component.lib.createSnapshot,
      { table_name: args.tableName },
    );

    // Mark as writing
    await ctx.runMutation(this.component.lib.updateSnapshot, {
      snapshot_id: snapshotId,
      status: "writing" as const,
    });

    const timestamp = Date.now();
    const s3Key = `${table.s3_key_prefix}/${timestamp}.parquet`;

    try {
      // Call sidecar to write Parquet to S3
      const response = await fetchWithTimeout(
        `${this.sidecarURL}/snapshot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table_name: args.tableName,
            data: args.data,
            columns: table.columns,
            s3_key: s3Key,
            s3_config: this.s3Config,
          }),
        },
        this.snapshotTimeoutMs,
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Sidecar snapshot failed: ${(err as any).error ?? response.statusText}`);
      }

      const result = (await response.json()) as {
        s3_key: string;
        row_count: number;
        parquet_size_bytes: number;
      };

      // Mark complete
      await ctx.runMutation(this.component.lib.updateSnapshot, {
        snapshot_id: snapshotId,
        status: "complete" as const,
        s3_key: result.s3_key,
        row_count: result.row_count,
      });

      return {
        s3Key: result.s3_key,
        rowCount: result.row_count,
        parquetSizeBytes: result.parquet_size_bytes,
      };
    } catch (error) {
      await ctx.runMutation(this.component.lib.updateSnapshot, {
        snapshot_id: snapshotId,
        status: "failed" as const,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Run a SQL query over snapshotted Parquet data via the sidecar service.
   */
  async query(
    ctx: RunQueryCtx,
    args: {
      sql: string;
      tableNames?: string[];
    },
  ): Promise<QueryResult> {
    // Resolve which tables are needed
    let tableNames: string[];
    if (args.tableNames) {
      tableNames = args.tableNames;
    } else {
      const tables = await ctx.runQuery(
        this.component.lib.listRegisteredTables,
        {},
      );
      tableNames = tables.map(
        (t: { table_name: string }) => t.table_name,
      );
    }

    // Get S3 paths for each table (latest snapshot or chunk glob)
    const tables: { name: string; s3_path: string }[] = [];
    for (const tableName of tableNames) {
      const snapshot = await ctx.runQuery(
        this.component.lib.getLatestSnapshot,
        { table_name: tableName },
      );
      if (!snapshot?.s3_key) continue;

      if (snapshot.chunk_count && snapshot.chunk_count > 0) {
        tables.push({
          name: tableName,
          s3_path: `${snapshot.s3_key}/*.parquet`,
        });
      } else {
        tables.push({
          name: tableName,
          s3_path: snapshot.s3_key,
        });
      }
    }

    if (tables.length === 0) {
      return { columns: [], rows: [], row_count: 0 };
    }

    // Call sidecar to execute SQL
    const response = await fetchWithTimeout(
      `${this.sidecarURL}/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: args.sql,
          tables,
          s3_config: this.s3Config,
        }),
      },
      this.queryTimeoutMs,
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Sidecar query failed: ${(err as any).error ?? response.statusText}`);
    }

    return (await response.json()) as QueryResult;
  }

  /**
   * Get the latest snapshot info for a table.
   */
  async getLatestSnapshot(ctx: RunQueryCtx, tableName: string) {
    return await ctx.runQuery(this.component.lib.getLatestSnapshot, {
      table_name: tableName,
    });
  }

  /**
   * List snapshots, optionally filtered by table name.
   */
  async listSnapshots(
    ctx: RunQueryCtx,
    args?: { tableName?: string; limit?: number },
  ) {
    return await ctx.runQuery(this.component.lib.listSnapshots, {
      table_name: args?.tableName,
      limit: args?.limit,
    });
  }
}

// Re-export old name for backwards compatibility during transition
export { DuckDBClient as DuckDB };
