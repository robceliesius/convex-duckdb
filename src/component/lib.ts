import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

// Register a table for analytics export
export const registerTable = mutation({
  args: {
    table_name: v.string(),
    columns: v.array(
      v.object({
        source: v.string(),
        target: v.string(),
        type: v.string(),
      }),
    ),
    s3_key_prefix: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tableName = args.table_name.trim();
    if (!tableName) {
      throw new Error("table_name must be non-empty");
    }
    if (args.columns.length === 0) {
      throw new Error("columns must be non-empty");
    }

    const s3KeyPrefix =
      args.s3_key_prefix === undefined ? undefined : args.s3_key_prefix.trim();
    if (args.s3_key_prefix !== undefined && !s3KeyPrefix) {
      throw new Error("s3_key_prefix must be non-empty when provided");
    }

    // Normalize/validate columns and ensure Parquet column names are unique.
    const seen = new Set<string>();
    const columns = args.columns.map((c) => {
      const source = c.source.trim();
      if (!source) throw new Error("columns[].source must be non-empty");
      const target = c.target.trim();
      if (!target) throw new Error("columns[].target must be non-empty");
      const type = c.type.trim();
      if (!type) throw new Error("columns[].type must be non-empty");
      if (seen.has(target)) {
        throw new Error(`duplicate columns[].target: "${target}"`);
      }
      seen.add(target);
      return { source, target, type };
    });

    const existing = await ctx.db
      .query("registered_tables")
      .withIndex("by_table_name", (q) => q.eq("table_name", tableName))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        columns,
        // Do not change the prefix unless explicitly provided.
        s3_key_prefix: s3KeyPrefix ?? existing.s3_key_prefix,
      });
    } else {
      await ctx.db.insert("registered_tables", {
        table_name: tableName,
        columns,
        s3_key_prefix: s3KeyPrefix ?? tableName,
      });
    }
    return null;
  },
});

// Get a registered table's config
export const getRegisteredTable = query({
  args: { table_name: v.string() },
  returns: v.union(
    v.object({
      _id: v.any(),
      _creationTime: v.number(),
      table_name: v.string(),
      columns: v.array(
        v.object({
          source: v.string(),
          target: v.string(),
          type: v.string(),
        }),
      ),
      s3_key_prefix: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tableName = args.table_name.trim();
    if (!tableName) return null;
    return await ctx.db
      .query("registered_tables")
      .withIndex("by_table_name", (q) => q.eq("table_name", tableName))
      .first();
  },
});

// List all registered tables
export const listRegisteredTables = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.any(),
      _creationTime: v.number(),
      table_name: v.string(),
      columns: v.array(
        v.object({
          source: v.string(),
          target: v.string(),
          type: v.string(),
        }),
      ),
      s3_key_prefix: v.string(),
    }),
  ),
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
    const tableName = args.table_name.trim();
    if (!tableName) {
      throw new Error("table_name must be non-empty");
    }
    return await ctx.db.insert("snapshots", {
      table_name: tableName,
      status: "pending",
      created_at: Date.now(),
    });
  },
});

// Update snapshot status
export const updateSnapshot = mutation({
  args: {
    snapshot_id: v.id("snapshots"),
    status: v.union(
      v.literal("pending"),
      v.literal("writing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    s3_key: v.optional(v.string()),
    row_count: v.optional(v.number()),
    chunk_count: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { snapshot_id, ...updates } = args;
    const patch: Record<string, unknown> = { ...updates };
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
  returns: v.union(
    v.object({
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
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tableName = args.table_name.trim();
    if (!tableName) return null;
    return await ctx.db
      .query("snapshots")
      .withIndex("by_table_name_and_status", (q) =>
        q.eq("table_name", tableName).eq("status", "complete"),
      )
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
  returns: v.array(
    v.object({
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
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    if (args.table_name) {
      const tableName = args.table_name.trim();
      if (!tableName) return [];
      return await ctx.db
        .query("snapshots")
        .withIndex("by_table_name", (q) =>
          q.eq("table_name", tableName),
        )
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("snapshots").order("desc").take(limit);
  },
});

// Delete a snapshot by ID
export const deleteSnapshot = mutation({
  args: { snapshot_id: v.id("snapshots") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.snapshot_id);
    return null;
  },
});

// Delete a registered table by name (and all its snapshots)
export const deleteRegisteredTable = mutation({
  args: { table_name: v.string() },
  returns: v.object({ deleted_snapshots: v.number() }),
  handler: async (ctx, args) => {
    const tableName = args.table_name.trim();
    if (!tableName) throw new Error("table_name must be non-empty");

    // Delete all snapshots for this table
    const snapshots = await ctx.db
      .query("snapshots")
      .withIndex("by_table_name", (q) => q.eq("table_name", tableName))
      .collect();
    for (const s of snapshots) {
      await ctx.db.delete(s._id);
    }

    // Delete the table registration
    const table = await ctx.db
      .query("registered_tables")
      .withIndex("by_table_name", (q) => q.eq("table_name", tableName))
      .first();
    if (table) {
      await ctx.db.delete(table._id);
    }

    return { deleted_snapshots: snapshots.length };
  },
});
