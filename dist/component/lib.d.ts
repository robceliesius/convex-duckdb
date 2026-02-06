export declare const registerTable: import("convex/server").RegisteredMutation<"public", {
    s3_key_prefix?: string | undefined;
    table_name: string;
    columns: {
        source: string;
        target: string;
        type: string;
    }[];
}, Promise<null>>;
export declare const getRegisteredTable: import("convex/server").RegisteredQuery<"public", {
    table_name: string;
}, Promise<{
    _id: import("convex/values").GenericId<"registered_tables">;
    _creationTime: number;
    table_name: string;
    columns: {
        source: string;
        target: string;
        type: string;
    }[];
    s3_key_prefix: string;
} | null>>;
export declare const listRegisteredTables: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    _id: import("convex/values").GenericId<"registered_tables">;
    _creationTime: number;
    table_name: string;
    columns: {
        source: string;
        target: string;
        type: string;
    }[];
    s3_key_prefix: string;
}[]>>;
export declare const createSnapshot: import("convex/server").RegisteredMutation<"public", {
    table_name: string;
}, Promise<import("convex/values").GenericId<"snapshots">>>;
export declare const updateSnapshot: import("convex/server").RegisteredMutation<"public", {
    row_count?: number | undefined;
    s3_key?: string | undefined;
    chunk_count?: number | undefined;
    error?: string | undefined;
    snapshot_id: import("convex/values").GenericId<"snapshots">;
    status: "pending" | "writing" | "complete" | "failed";
}, Promise<null>>;
export declare const getLatestSnapshot: import("convex/server").RegisteredQuery<"public", {
    table_name: string;
}, Promise<{
    _id: import("convex/values").GenericId<"snapshots">;
    _creationTime: number;
    row_count?: number | undefined;
    s3_key?: string | undefined;
    chunk_count?: number | undefined;
    error?: string | undefined;
    completed_at?: number | undefined;
    table_name: string;
    status: "pending" | "writing" | "complete" | "failed";
    created_at: number;
} | null>>;
export declare const listSnapshots: import("convex/server").RegisteredQuery<"public", {
    table_name?: string | undefined;
    limit?: number | undefined;
}, Promise<{
    _id: import("convex/values").GenericId<"snapshots">;
    _creationTime: number;
    row_count?: number | undefined;
    s3_key?: string | undefined;
    chunk_count?: number | undefined;
    error?: string | undefined;
    completed_at?: number | undefined;
    table_name: string;
    status: "pending" | "writing" | "complete" | "failed";
    created_at: number;
}[]>>;
//# sourceMappingURL=lib.d.ts.map