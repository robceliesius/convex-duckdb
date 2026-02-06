/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      createSnapshot: FunctionReference<
        "mutation",
        "internal",
        { table_name: string },
        string,
        Name
      >;
      getLatestSnapshot: FunctionReference<
        "query",
        "internal",
        { table_name: string },
        any,
        Name
      >;
      getRegisteredTable: FunctionReference<
        "query",
        "internal",
        { table_name: string },
        any,
        Name
      >;
      listRegisteredTables: FunctionReference<
        "query",
        "internal",
        {},
        Array<any>,
        Name
      >;
      listSnapshots: FunctionReference<
        "query",
        "internal",
        { limit?: number; table_name?: string },
        Array<any>,
        Name
      >;
      registerTable: FunctionReference<
        "mutation",
        "internal",
        {
          columns: Array<{ source: string; target: string; type: string }>;
          s3_key_prefix?: string;
          table_name: string;
        },
        null,
        Name
      >;
      updateSnapshot: FunctionReference<
        "mutation",
        "internal",
        {
          chunk_count?: number;
          error?: string;
          row_count?: number;
          s3_key?: string;
          snapshot_id: string;
          status: "pending" | "writing" | "complete" | "failed";
        },
        null,
        Name
      >;
      deleteSnapshot: FunctionReference<
        "mutation",
        "internal",
        { snapshot_id: string },
        null,
        Name
      >;
      deleteRegisteredTable: FunctionReference<
        "mutation",
        "internal",
        { table_name: string },
        { deleted_snapshots: number },
        Name
      >;
    };
  };
