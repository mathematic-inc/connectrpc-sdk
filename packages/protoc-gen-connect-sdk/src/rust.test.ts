import { create } from "@bufbuild/protobuf";
import { CodeGeneratorRequestSchema } from "@bufbuild/protobuf/wkt";
import { compileFile } from "@bufbuild/protocompile";
import { describe, expect, test } from "vitest";

import { plugin } from "./plugin.js";

/**
 * Generates the Rust SDK for one schema fragment and returns the source.
 *
 * Drives the plugin through the same request `buf` sends, so the options
 * parsing and the Rust emitter are both covered. Real descriptors compiled
 * from proto text, because the method kind is read off the descriptor; a
 * hand-built literal would not carry it.
 */
function generate(body: string): string {
  const file = compileFile(
    `
      syntax = "proto3";
      package test.v1;

      message Request {}
      message Response {}

      ${body}
    `,
  );
  const response = plugin.run(
    create(CodeGeneratorRequestSchema, {
      fileToGenerate: [file.proto.name],
      parameter:
        "language=rust,service_path=crate::generated::service," +
        "message_path=crate::generated::messages",
      protoFile: [file.proto],
      sourceFileDescriptors: [file.proto],
    }),
  );
  if (response.error !== undefined && response.error !== "") {
    throw new Error(response.error);
  }
  return response.file.map((generated) => generated.content).join("\n");
}

describe("generateRust", () => {
  test("emits a file that can be pulled in with include!", () => {
    const source = generate(`
      service WorkspaceService {
        rpc CreateWorkspace(Request) returns (Response);
      }
    `);
    // `include!` splices this into the middle of a module, where an inner doc
    // comment is a compile error. The header therefore cannot use `//!`.
    expect(source).not.toMatch(/^\/\/!/mv);
  });

  test("a client-streaming method takes an iterator of requests", () => {
    const source = generate(`
      service DeliveryService {
        rpc RecordReceipts(stream Request) returns (Response);
      }
    `);
    // Many requests, one response: the signature must accept the stream, and
    // return the response message rather than a stream of them.
    expect(source).toContain(
      "requests: impl IntoIterator<Item = crate::generated::messages::Request>,",
    );
    expect(source).toContain(".record_receipts(requests)");
    expect(source).toContain("::connectrpc::client::call_client_stream::<_, _, RespView>(");
  });

  test("a server-streaming method returns the stream", () => {
    const source = generate(`
      service RuntimeService {
        rpc SubscribeEvents(Request) returns (stream Response);
      }
    `);
    expect(source).toContain("::connectrpc::client::ServerStream<T::ResponseBody,");
    expect(source).toContain("::connectrpc::client::call_server_stream(");
  });
});
