export declare const columnMappingValidator: import("convex/values").VObject<{
    source: string;
    target: string;
    type: string;
}, {
    source: import("convex/values").VString<string, "required">;
    target: import("convex/values").VString<string, "required">;
    type: import("convex/values").VString<string, "required">;
}, "required", "source" | "target" | "type">;
export declare const snapshotStatusValidator: import("convex/values").VUnion<"pending" | "writing" | "complete" | "failed", [import("convex/values").VLiteral<"pending", "required">, import("convex/values").VLiteral<"writing", "required">, import("convex/values").VLiteral<"complete", "required">, import("convex/values").VLiteral<"failed", "required">], "required", never>;
export declare const registerTableArgs: {
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
    s3_key_prefix: import("convex/values").VString<string | undefined, "optional">;
};
export declare const snapshotArgs: {
    table_name: import("convex/values").VString<string, "required">;
    data: import("convex/values").VArray<any[], import("convex/values").VAny<any, "required", string>, "required">;
};
export declare const startSnapshotArgs: {
    table_name: import("convex/values").VString<string, "required">;
};
export declare const appendChunkArgs: {
    snapshot_id: import("convex/values").VString<string, "required">;
    data: import("convex/values").VArray<any[], import("convex/values").VAny<any, "required", string>, "required">;
    chunk_index: import("convex/values").VFloat64<number, "required">;
};
export declare const finalizeSnapshotArgs: {
    snapshot_id: import("convex/values").VString<string, "required">;
};
export declare const queryArgs: {
    sql: import("convex/values").VString<string, "required">;
    table_names: import("convex/values").VArray<string[] | undefined, import("convex/values").VString<string, "required">, "optional">;
};
export declare const s3ConfigValidator: import("convex/values").VObject<{
    region?: string | undefined;
    forcePathStyle?: boolean | undefined;
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
}, {
    endpoint: import("convex/values").VString<string, "required">;
    bucket: import("convex/values").VString<string, "required">;
    region: import("convex/values").VString<string | undefined, "optional">;
    accessKeyId: import("convex/values").VString<string, "required">;
    secretAccessKey: import("convex/values").VString<string, "required">;
    forcePathStyle: import("convex/values").VBoolean<boolean | undefined, "optional">;
}, "required", "endpoint" | "bucket" | "region" | "accessKeyId" | "secretAccessKey" | "forcePathStyle">;
//# sourceMappingURL=shared.d.ts.map