import type { GenericActionCtx, GenericDataModel, GenericMutationCtx, GenericQueryCtx } from "convex/server";
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
export declare class DuckDB {
    private component;
    private s3Config;
    constructor(component: ComponentApi, s3Config: S3Config);
    private get s3Args();
    /**
     * Register a table for analytics export with column mappings.
     */
    registerTable(ctx: RunMutationCtx, args: {
        tableName: string;
        columns: ColumnMapping[];
        s3KeyPrefix?: string;
    }): Promise<void>;
    /**
     * Get a registered table's configuration.
     */
    getRegisteredTable(ctx: RunQueryCtx, tableName: string): Promise<any>;
    /**
     * List all registered tables.
     */
    listRegisteredTables(ctx: RunQueryCtx): Promise<any>;
    /**
     * Snapshot data to S3 as Parquet in one shot.
     * Consumer fetches their own data and passes it here.
     */
    snapshot(ctx: FullCtx, args: {
        tableName: string;
        data: Record<string, unknown>[];
    }): Promise<{
        s3Key: string;
        rowCount: number;
    }>;
    /**
     * Start a chunked snapshot for large tables.
     * Returns a snapshot context to use with appendChunk/finalizeSnapshot.
     */
    startSnapshot(ctx: RunQueryCtx & RunMutationCtx, tableName: string): Promise<ChunkedSnapshot>;
    /**
     * Run a SQL query over snapshotted Parquet data.
     * By default queries all registered tables, or specify table names.
     */
    query(ctx: FullCtx, args: {
        sql: string;
        tableNames?: string[];
    }): Promise<QueryResult>;
    /**
     * Get the latest snapshot info for a table.
     */
    getLatestSnapshot(ctx: RunQueryCtx, tableName: string): Promise<any>;
    /**
     * List snapshots, optionally filtered by table name.
     */
    listSnapshots(ctx: RunQueryCtx, args?: {
        tableName?: string;
        limit?: number;
    }): Promise<any>;
}
/**
 * Handles chunked snapshots for large tables.
 * Use with DuckDB.startSnapshot().
 */
export declare class ChunkedSnapshot {
    private component;
    private s3Args;
    private bucket;
    readonly snapshotId: string;
    readonly tableName: string;
    private columns;
    private s3KeyPrefix;
    private chunkIndex;
    private totalRows;
    private chunkKeys;
    constructor(component: ComponentApi, s3Args: Record<string, unknown>, bucket: string, snapshotId: string, tableName: string, columns: ColumnMapping[], s3KeyPrefix: string);
    /**
     * Append a chunk of data. Call this in a loop as you paginate.
     */
    appendChunk(ctx: RunActionCtx, data: Record<string, unknown>[]): Promise<{
        s3Key: string;
        rowCount: number;
    }>;
    /**
     * Finalize the chunked snapshot. Marks it complete with metadata.
     */
    finalize(ctx: RunMutationCtx): Promise<void>;
}
export {};
//# sourceMappingURL=index.d.ts.map