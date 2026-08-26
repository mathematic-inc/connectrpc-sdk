/**
 * The plugin, which emits one language per invocation.
 *
 * TypeScript and Rust come out of one plugin because they share the naming
 * rules; a schema that renames a method renames it in both SDKs or the two
 * drift. `language=rust` selects the Rust emitter, and the default is
 * TypeScript.
 */

import { createEcmaScriptPlugin } from "@bufbuild/protoplugin";
import type { Plugin } from "@bufbuild/protoplugin";

import { generateRust, type RustOptions } from "./rust.js";
import { generateTypeScript } from "./typescript.js";

const ecmaScriptPlugin = createEcmaScriptPlugin<RustOptions & { language: "typescript" | "rust" }>({
  name: "protoc-gen-connect-sdk",
  version: "v0.1.0",
  parseOptions(raw) {
    let language: "typescript" | "rust" = "typescript";
    let servicePath = "";
    let messagePath = "";
    const externPaths = new Map<string, string>();
    for (const { key, value } of raw) {
      switch (key) {
        case "language":
          if (value !== "typescript" && value !== "rust") {
            throw new Error(`Unknown language "${value}". Use "typescript" or "rust".`);
          }
          language = value;
          break;
        case "service_path":
          servicePath = value;
          break;
        case "message_path":
          messagePath = value;
          break;
        case "extern_path": {
          // `.google.protobuf=::buffa_types::google::protobuf`, matching the
          // spelling the message and service generators already take.
          const split = value.indexOf("=");
          if (split === -1) {
            throw new Error(
              `extern_path expects "<proto package>=<rust path>", but got "${value}".`,
            );
          }
          externPaths.set(value.slice(0, split).replace(/^\./v, ""), value.slice(split + 1));
          break;
        }
        default:
          throw new Error(`Unknown option "${key}".`);
      }
    }
    if (language === "rust" && (servicePath === "" || messagePath === "")) {
      throw new Error(
        'The Rust SDK delegates to generated clients, so it needs "service_path" and ' +
          '"message_path" naming where those were generated.',
      );
    }
    return { language, servicePath, messagePath, externPaths };
  },
  generateTs(schema) {
    if (schema.options.language === "rust") {
      generateRust(schema);
      return;
    }
    generateTypeScript(schema);
  },
});

/**
 * Runs the plugin, asking for TypeScript whenever Rust is the language.
 *
 * The ECMAScript plugin framework emits JavaScript and declarations by
 * default and drops anything generated outside the requested targets. Rust
 * output rides the TypeScript pass, so the request says so rather than every
 * `buf.gen.yaml` having to say `target=ts` for a language that has no such
 * thing.
 */
export const plugin: Plugin = {
  ...ecmaScriptPlugin,
  run(request) {
    const parameter = request.parameter ?? "";
    return ecmaScriptPlugin.run(
      /\blanguage=rust\b/v.test(parameter) && !/\btarget=/v.test(parameter)
        ? { ...request, parameter: `${parameter},target=ts` }
        : request,
    );
  },
};
