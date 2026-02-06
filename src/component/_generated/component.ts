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
    actions: {
      queryDuckDB: FunctionReference<
        "action",
        "internal",
        {
          s3_access_key_id: string;
          s3_bucket: string;
          s3_endpoint: string;
          s3_force_path_style?: boolean;
          s3_region?: string;
          s3_secret_access_key: string;
          sql: string;
          table_s3_paths: Array<{ s3_path: string; table_name: string }>;
        },
        { columns: Array<string>; row_count: number; rows: Array<any> },
        Name
      >;
      snapshotChunkToS3: FunctionReference<
        "action",
        "internal",
        {
          chunk_index: number;
          columns: Array<{ source: string; target: string; type: string }>;
          data: Array<any>;
          s3_access_key_id: string;
          s3_bucket: string;
          s3_endpoint: string;
          s3_force_path_style?: boolean;
          s3_key_prefix: string;
          s3_region?: string;
          s3_secret_access_key: string;
          snapshot_id: string;
          table_name: string;
        },
        { row_count: number; s3_key: string },
        Name
      >;
      snapshotToS3: FunctionReference<
        "action",
        "internal",
        {
          columns: Array<{ source: string; target: string; type: string }>;
          data: Array<any>;
          s3_access_key_id: string;
          s3_bucket: string;
          s3_endpoint: string;
          s3_force_path_style?: boolean;
          s3_key_prefix: string;
          s3_region?: string;
          s3_secret_access_key: string;
          snapshot_id: string;
          table_name: string;
        },
        { row_count: number; s3_key: string },
        Name
      >;
    };
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
    };
  };
