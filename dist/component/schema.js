import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
    registered_tables: defineTable({
        table_name: v.string(),
        columns: v.array(v.object({
            source: v.string(),
            target: v.string(),
            type: v.string(),
        })),
        s3_key_prefix: v.string(),
    }).index("by_table_name", ["table_name"]),
    snapshots: defineTable({
        table_name: v.string(),
        status: v.union(v.literal("pending"), v.literal("writing"), v.literal("complete"), v.literal("failed")),
        s3_key: v.optional(v.string()),
        row_count: v.optional(v.number()),
        error: v.optional(v.string()),
        chunk_count: v.optional(v.number()),
        created_at: v.number(),
        completed_at: v.optional(v.number()),
    })
        .index("by_table_name", ["table_name"])
        .index("by_table_name_and_status", ["table_name", "status"]),
});
//# sourceMappingURL=schema.js.map