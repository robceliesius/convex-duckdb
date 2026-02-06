import { v } from "convex/values";
// Column mapping validator
export const columnMappingValidator = v.object({
    source: v.string(),
    target: v.string(),
    type: v.string(), // DuckDB type: VARCHAR, INTEGER, DOUBLE, BOOLEAN, TIMESTAMP, etc.
});
// Snapshot status
export const snapshotStatusValidator = v.union(v.literal("pending"), v.literal("writing"), v.literal("complete"), v.literal("failed"));
// Args validators for component functions
export const registerTableArgs = {
    table_name: v.string(),
    columns: v.array(columnMappingValidator),
    s3_key_prefix: v.optional(v.string()),
};
export const snapshotArgs = {
    table_name: v.string(),
    data: v.array(v.any()),
};
export const startSnapshotArgs = {
    table_name: v.string(),
};
export const appendChunkArgs = {
    snapshot_id: v.string(),
    data: v.array(v.any()),
    chunk_index: v.number(),
};
export const finalizeSnapshotArgs = {
    snapshot_id: v.string(),
};
export const queryArgs = {
    sql: v.string(),
    table_names: v.optional(v.array(v.string())),
};
// S3 config passed to actions
export const s3ConfigValidator = v.object({
    endpoint: v.string(),
    bucket: v.string(),
    region: v.optional(v.string()),
    accessKeyId: v.string(),
    secretAccessKey: v.string(),
    forcePathStyle: v.optional(v.boolean()),
});
//# sourceMappingURL=shared.js.map