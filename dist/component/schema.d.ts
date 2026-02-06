declare const _default: import("convex/server").SchemaDefinition<{
    registered_tables: import("convex/server").TableDefinition<import("convex/values").VObject<{
        table_name: string;
        columns: {
            source: string;
            target: string;
            type: string;
        }[];
        s3_key_prefix: string;
    }, {
        table_name: import("convex/values").VString<string, "required">;
        columns: import("convex/values").VArray<{
            source: string;
            target: string;
            type: string;
        }[], import("convex/values").VObject<{
            source: string;
            target: string;
            type: string;
        }, {
            source: import("convex/values").VString<string, "required">;
            target: import("convex/values").VString<string, "required">;
            type: import("convex/values").VString<string, "required">;
        }, "required", "source" | "target" | "type">, "required">;
        s3_key_prefix: import("convex/values").VString<string, "required">;
    }, "required", "table_name" | "columns" | "s3_key_prefix">, {
        by_table_name: ["table_name", "_creationTime"];
    }, {}, {}>;
    snapshots: import("convex/server").TableDefinition<import("convex/values").VObject<{
        row_count?: number | undefined;
        s3_key?: string | undefined;
        chunk_count?: number | undefined;
        error?: string | undefined;
        completed_at?: number | undefined;
        table_name: string;
        status: "pending" | "writing" | "complete" | "failed";
        created_at: number;
    }, {
        table_name: import("convex/values").VString<string, "required">;
        status: import("convex/values").VUnion<"pending" | "writing" | "complete" | "failed", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"writing", "required">, import("convex/values").VLiteral<"complete", "required">, import("convex/values").VLiteral<"failed", "required">], "required", never>;
        s3_key: import("convex/values").VString<string | undefined, "optional">;
        row_count: import("convex/values").VFloat64<number | undefined, "optional">;
        error: import("convex/values").VString<string | undefined, "optional">;
        chunk_count: import("convex/values").VFloat64<number | undefined, "optional">;
        created_at: import("convex/values").VFloat64<number, "required">;
        completed_at: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "table_name" | "row_count" | "status" | "s3_key" | "chunk_count" | "error" | "created_at" | "completed_at">, {
        by_table_name: ["table_name", "_creationTime"];
        by_table_name_and_status: ["table_name", "status", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map