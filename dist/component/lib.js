import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
// Register a table for analytics export
export const registerTable = mutation({
    args: {
        table_name: v.string(),
        columns: v.array(v.object({
            source: v.string(),
            target: v.string(),
            type: v.string(),
        })),
        s3_key_prefix: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("registered_tables")
            .withIndex("by_table_name", (q) => q.eq("table_name", args.table_name))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, {
                columns: args.columns,
                s3_key_prefix: args.s3_key_prefix ?? args.table_name,
            });
        }
        else {
            await ctx.db.insert("registered_tables", {
                table_name: args.table_name,
                columns: args.columns,
                s3_key_prefix: args.s3_key_prefix ?? args.table_name,
            });
        }
        return null;
    },
});
// Get a registered table's config
export const getRegisteredTable = query({
    args: { table_name: v.string() },
    returns: v.union(v.object({
        _id: v.any(),
        _creationTime: v.number(),
        table_name: v.string(),
        columns: v.array(v.object({
            source: v.string(),
            target: v.string(),
            type: v.string(),
        })),
        s3_key_prefix: v.string(),
    }), v.null()),
    handler: async (ctx, args) => {
        return await ctx.db
            .query("registered_tables")
            .withIndex("by_table_name", (q) => q.eq("table_name", args.table_name))
            .first();
    },
});
// List all registered tables
export const listRegisteredTables = query({
    args: {},
    returns: v.array(v.object({
        _id: v.any(),
        _creationTime: v.number(),
        table_name: v.string(),
        columns: v.array(v.object({
            source: v.string(),
            target: v.string(),
            type: v.string(),
        })),
        s3_key_prefix: v.string(),
    })),
    handler: async (ctx) => {
        return await ctx.db.query("registered_tables").collect();
    },
});
// Create a pending snapshot record
export const createSnapshot = mutation({
    args: {
        table_name: v.string(),
    },
    returns: v.id("snapshots"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("snapshots", {
            table_name: args.table_name,
            status: "pending",
            created_at: Date.now(),
        });
    },
});
// Update snapshot status
export const updateSnapshot = mutation({
    args: {
        snapshot_id: v.id("snapshots"),
        status: v.union(v.literal("pending"), v.literal("writing"), v.literal("complete"), v.literal("failed")),
        s3_key: v.optional(v.string()),
        row_count: v.optional(v.number()),
        chunk_count: v.optional(v.number()),
        error: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const { snapshot_id, ...updates } = args;
        const patch = { ...updates };
        if (args.status === "complete" || args.status === "failed") {
            patch.completed_at = Date.now();
        }
        await ctx.db.patch(snapshot_id, patch);
        return null;
    },
});
// Get latest complete snapshot for a table
export const getLatestSnapshot = query({
    args: { table_name: v.string() },
    returns: v.union(v.object({
        _id: v.any(),
        _creationTime: v.number(),
        table_name: v.string(),
        status: v.string(),
        s3_key: v.optional(v.string()),
        row_count: v.optional(v.number()),
        chunk_count: v.optional(v.number()),
        error: v.optional(v.string()),
        created_at: v.number(),
        completed_at: v.optional(v.number()),
    }), v.null()),
    handler: async (ctx, args) => {
        return await ctx.db
            .query("snapshots")
            .withIndex("by_table_name_and_status", (q) => q.eq("table_name", args.table_name).eq("status", "complete"))
            .order("desc")
            .first();
    },
});
// List snapshots for a table
export const listSnapshots = query({
    args: {
        table_name: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    returns: v.array(v.object({
        _id: v.any(),
        _creationTime: v.number(),
        table_name: v.string(),
        status: v.string(),
        s3_key: v.optional(v.string()),
        row_count: v.optional(v.number()),
        chunk_count: v.optional(v.number()),
        error: v.optional(v.string()),
        created_at: v.number(),
        completed_at: v.optional(v.number()),
    })),
    handler: async (ctx, args) => {
        const limit = args.limit ?? 20;
        if (args.table_name) {
            return await ctx.db
                .query("snapshots")
                .withIndex("by_table_name", (q) => q.eq("table_name", args.table_name))
                .order("desc")
                .take(limit);
        }
        return await ctx.db.query("snapshots").order("desc").take(limit);
    },
});
//# sourceMappingURL=lib.js.map