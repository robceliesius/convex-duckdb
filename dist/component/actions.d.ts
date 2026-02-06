export declare const snapshotToS3: import("convex/server").RegisteredAction<"public", {
    s3_region?: string | undefined;
    s3_force_path_style?: boolean | undefined;
    table_name: string;
    columns: {
        source: string;
        target: string;
        type: string;
    }[];
    s3_key_prefix: string;
    snapshot_id: import("convex/values").GenericId<"snapshots">;
    data: any[];
    s3_endpoint: string;
    s3_bucket: string;
    s3_access_key_id: string;
    s3_secret_access_key: string;
}, Promise<{
    s3_key: string;
    row_count: number;
}>>;
export declare const snapshotChunkToS3: import("convex/server").RegisteredAction<"public", {
    s3_region?: string | undefined;
    s3_force_path_style?: boolean | undefined;
    table_name: string;
    columns: {
        source: string;
        target: string;
        type: string;
    }[];
    s3_key_prefix: string;
    snapshot_id: import("convex/values").GenericId<"snapshots">;
    data: any[];
    s3_endpoint: string;
    s3_bucket: string;
    s3_access_key_id: string;
    s3_secret_access_key: string;
    chunk_index: number;
}, Promise<{
    s3_key: string;
    row_count: number;
}>>;
export declare const queryDuckDB: import("convex/server").RegisteredAction<"public", {
    s3_region?: string | undefined;
    s3_force_path_style?: boolean | undefined;
    s3_endpoint: string;
    s3_bucket: string;
    s3_access_key_id: string;
    s3_secret_access_key: string;
    sql: string;
    table_s3_paths: {
        table_name: string;
        s3_path: string;
    }[];
}, Promise<{
    columns: string[];
    rows: Record<string, unknown>[];
    row_count: number;
}>>;
//# sourceMappingURL=actions.d.ts.map