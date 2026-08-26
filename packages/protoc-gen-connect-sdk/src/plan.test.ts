import { readFileSync } from "node:fs";

import type { DescService } from "@bufbuild/protobuf";
import { compileFile } from "@bufbuild/protocompile";
import { describe, expect, test } from "vitest";

import { findCollision, planNamespaces } from "./plan.js";

/**
 * Compiles a schema fragment and returns its services.
 *
 * Real descriptors rather than hand-built objects, since the annotations are
 * read through the descriptor's own options and a literal would not carry
 * them.
 */
function servicesOf(body: string): DescService[] {
  const file = compileFile(
    `
      syntax = "proto3";
      package test.v1;
      import "connectsdk/v1/annotations.proto";

      message Request {}
      message Response {}

      ${body}
    `,
    {
      imports: {
        "connectsdk/v1/annotations.proto": readFileSync(
          new URL("../../../proto/connectsdk/v1/annotations.proto", import.meta.url),
          "utf8",
        ),
      },
    },
  );
  return [...file.services];
}

describe("planNamespaces", () => {
  test("groups a service's methods under the namespace derived from its name", () => {
    const [namespace] = planNamespaces(
      servicesOf(`
        service WorkspaceService {
          rpc ListWorkspaces(Request) returns (Response);
          rpc CreateWorkspace(Request) returns (Response);
          rpc SetDraftMode(Request) returns (Response);
        }
      `),
    );
    expect(namespace?.name).toBe("workspaces");
    expect(namespace?.methods.map((method) => method.name)).toStrictEqual([
      "list",
      "create",
      "setDraftMode",
    ]);
  });

  test("merges services that declare the same namespace", () => {
    // Two services, one client-facing surface: the schema splits them for its
    // own reasons and the SDK presents them as one.
    const namespaces = planNamespaces(
      servicesOf(`
        service EntityService {
          rpc GetEntity(Request) returns (Response);
        }
        service EntityAdminService {
          option (connectsdk.v1.namespace) = "entities";
          rpc PurgeEntity(Request) returns (Response);
        }
      `),
    );
    expect(namespaces).toHaveLength(1);
    expect(namespaces[0]?.name).toBe("entities");
    expect(namespaces[0]?.methods.map((method) => method.name)).toStrictEqual(["get", "purge"]);
  });

  test("applies the method override in place of the derived name", () => {
    const [namespace] = planNamespaces(
      servicesOf(`
        service ExportService {
          rpc ListEntityExports(Request) returns (Response) {
            option (connectsdk.v1.method) = "listForEntity";
          }
        }
      `),
    );
    expect(namespace?.methods[0]?.name).toBe("listForEntity");
  });
});

describe("findCollision", () => {
  test("reports two methods that derive one name", () => {
    // Singular and plural both reduce to `get`, and the generated client
    // would otherwise keep only the second.
    const [namespace] = planNamespaces(
      servicesOf(`
        service WorkspaceService {
          rpc GetWorkspace(Request) returns (Response);
          rpc GetWorkspaces(Request) returns (Response);
        }
      `),
    );
    expect(findCollision(namespace!)).toBe("get");
  });

  test("passes a namespace whose names are distinct", () => {
    const [namespace] = planNamespaces(
      servicesOf(`
        service WorkspaceService {
          rpc GetWorkspace(Request) returns (Response);
          rpc ListWorkspaces(Request) returns (Response);
        }
      `),
    );
    expect(findCollision(namespace!)).toBeUndefined();
  });
});
