import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
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

type RunActionCtx = {
  runAction: GenericActionCtx<GenericDataModel>["runAction"];
};

type FullCtx = RunQueryCtx & RunMutationCtx & RunActionCtx;

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

export class DuckDB {
  private component: ComponentApi;
  private s3Config: S3Config;

  constructor(component: ComponentApi, s3Config: S3Config) {
    this.component = component;
    this.s3Config = s3Config;
  }

  private get s3Args() {
    return {
      s3_endpoint: this.s3Config.endpoint,
      s3_bucket: this.s3Config.bucket,
      s3_region: this.s3Config.region,
      s3_access_key_id: this.s3Config.accessKeyId,
      s3_secret_access_key: this.s3Config.secretAccessKey,
      s3_force_path_style: this.s3Config.forcePathStyle,
    };
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
   * Snapshot data to S3 as Parquet in one shot.
   * Consumer fetches their own data and passes it here.
   */
  async snapshot(
    ctx: FullCtx,
    args: {
      tableName: string;
      data: Record<string, unknown>[];
    },
  ): Promise<{ s3Key: string; rowCount: number }> {
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

    // Run action to write Parquet to S3
    const result = await ctx.runAction(this.component.actions.snapshotToS3, {
      snapshot_id: snapshotId,
      table_name: args.tableName,
      data: args.data,
      columns: table.columns,
      s3_key_prefix: table.s3_key_prefix,
      ...this.s3Args,
    });

    return { s3Key: result.s3_key, rowCount: result.row_count };
  }

  /**
   * Start a chunked snapshot for large tables.
   * Returns a snapshot context to use with appendChunk/finalizeSnapshot.
   */
  async startSnapshot(
    ctx: RunQueryCtx & RunMutationCtx,
    tableName: string,
  ): Promise<ChunkedSnapshot> {
    const table = await ctx.runQuery(this.component.lib.getRegisteredTable, {
      table_name: tableName,
    });
    if (!table) {
      throw new Error(`Table "${tableName}" is not registered`);
    }

    const snapshotId = await ctx.runMutation(
      this.component.lib.createSnapshot,
      { table_name: tableName },
    );

    return new ChunkedSnapshot(
      this.component,
      this.s3Args,
      this.s3Config.bucket,
      snapshotId,
      tableName,
      table.columns,
      table.s3_key_prefix,
    );
  }

  /**
   * Run a SQL query over snapshotted Parquet data.
   * By default queries all registered tables, or specify table names.
   */
  async query(
    ctx: FullCtx,
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
    const tableS3Paths: { table_name: string; s3_path: string }[] = [];
    for (const tableName of tableNames) {
      const table = await ctx.runQuery(
        this.component.lib.getRegisteredTable,
        { table_name: tableName },
      );
      if (!table) continue;

      const snapshot = await ctx.runQuery(
        this.component.lib.getLatestSnapshot,
        { table_name: tableName },
      );
      if (!snapshot?.s3_key) continue;

      // If the snapshot has chunks, use a glob pattern
      if (snapshot.chunk_count && snapshot.chunk_count > 0) {
        const chunkDir = snapshot.s3_key;
        tableS3Paths.push({
          table_name: tableName,
          s3_path: `${chunkDir}/*.parquet`,
        });
      } else {
        tableS3Paths.push({
          table_name: tableName,
          s3_path: snapshot.s3_key,
        });
      }
    }

    if (tableS3Paths.length === 0) {
      return { columns: [], rows: [], row_count: 0 };
    }

    return await ctx.runAction(this.component.actions.queryDuckDB, {
      sql: args.sql,
      table_s3_paths: tableS3Paths,
      ...this.s3Args,
    });
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

/**
 * Handles chunked snapshots for large tables.
 * Use with DuckDB.startSnapshot().
 */
export class ChunkedSnapshot {
  private chunkIndex = 0;
  private totalRows = 0;
  private chunkKeys: string[] = [];

  constructor(
    private component: ComponentApi,
    private s3Args: Record<string, unknown>,
    private bucket: string,
    public readonly snapshotId: string,
    public readonly tableName: string,
    private columns: ColumnMapping[],
    private s3KeyPrefix: string,
  ) {}

  /**
   * Append a chunk of data. Call this in a loop as you paginate.
   */
  async appendChunk(
    ctx: RunActionCtx,
    data: Record<string, unknown>[],
  ): Promise<{ s3Key: string; rowCount: number }> {
    const result = await ctx.runAction(
      this.component.actions.snapshotChunkToS3,
      {
        snapshot_id: this.snapshotId,
        table_name: this.tableName,
        data,
        columns: this.columns,
        s3_key_prefix: this.s3KeyPrefix,
        chunk_index: this.chunkIndex,
        ...this.s3Args,
      },
    );

    this.chunkIndex++;
    this.totalRows += result.row_count;
    this.chunkKeys.push(result.s3_key);

    return { s3Key: result.s3_key, rowCount: result.row_count };
  }

  /**
   * Finalize the chunked snapshot. Marks it complete with metadata.
   */
  async finalize(ctx: RunMutationCtx): Promise<void> {
    // The s3_key for chunked snapshots stores the chunk directory prefix
    const chunkDir = `${this.s3KeyPrefix}/chunks/${this.snapshotId}`;
    await ctx.runMutation(this.component.lib.updateSnapshot, {
      snapshot_id: this.snapshotId,
      status: "complete",
      s3_key: chunkDir,
      row_count: this.totalRows,
      chunk_count: this.chunkIndex,
    });
  }
}
