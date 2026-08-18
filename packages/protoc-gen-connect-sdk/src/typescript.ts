/**
 * The TypeScript SDK generator.
 *
 * Emits a namespaced facade over the clients `protoc-gen-es` already
 * generates. Nothing here touches the wire: `createClient` does the calling,
 * and this decides only what the methods are named and how they are grouped.
 */

import type { DescFile, DescMethod, DescService } from "@bufbuild/protobuf";
import type { GeneratedFile, Schema } from "@bufbuild/protoplugin";

import { findCollision, planNamespaces, type PlannedNamespace } from "./plan.js";

/**
 * Generates one client per proto package.
 *
 * A package is the unit a person installs and imports, so its services belong
 * on one client even when the schema spreads them over several files. Sloper
 * declares one service per file and still wants a single `client.workspaces`
 * beside `client.entities`.
 */
export function generateTypeScript(schema: Schema): void {
  for (const [, files] of groupByPackage(schema.files)) {
    const services = files.flatMap((file) => [...file.services]);
    if (services.length === 0) {
      continue;
    }
    const namespaces = planNamespaces(services);
    for (const namespace of namespaces) {
      const collision = findCollision(namespace);
      if (collision !== undefined) {
        throw new Error(
          `Two methods in "${namespace.name}" are both named "${collision}". ` +
            `Set option (connectsdk.v1.method) on one of them.`,
        );
      }
    }
    // Named for the directory the package generates into, so the client sits
    // beside the message files it is built from.
    const directory = files[0]!.name.split("/").slice(0, -1).join("/");
    generateFile(
      schema.generateFile(directory === "" ? "client.ts" : `${directory}/client.ts`),
      files[0]!,
      namespaces,
    );
  }
}

/** Groups files by proto package, preserving the order packages first appear. */
function groupByPackage(files: readonly DescFile[]): Map<string, DescFile[]> {
  const packages = new Map<string, DescFile[]>();
  for (const file of files) {
    const group = packages.get(file.proto.package) ?? [];
    group.push(file);
    packages.set(file.proto.package, group);
  }
  return packages;
}

function generateFile(f: GeneratedFile, file: DescFile, namespaces: PlannedNamespace[]): void {
  f.preamble(file);

  const createClient = f.import("createClient", "@connectrpc/connect");
  const transport = f.import("Transport", "@connectrpc/connect", true);

  // The facade's method signatures are read off the descriptors rather than
  // written out, so a change to a request or response type reaches callers
  // without this generator knowing the difference between them.
  const client = f.import("Client", "@connectrpc/connect", true);

  const name = sdkName(file);
  f.print();
  f.print(f.jsDoc(`The ${describe(file)}, grouped by resource.`));
  f.print(f.export("interface", name), " {");
  for (const namespace of namespaces) {
    f.print(f.jsDoc(namespaceDoc(namespace), "  "));
    f.print("  readonly ", namespace.name, ": {");
    for (const method of namespace.methods) {
      f.print(f.jsDoc(method.desc, "    "));
      f.print(
        "    readonly ",
        method.name,
        ": ",
        client,
        "<typeof ",
        f.importSchema(method.desc.parent),
        ">[",
        f.string(method.desc.localName),
        "];",
      );
    }
    f.print("  };");
  }
  f.print("}");

  f.print();
  f.print(
    f.jsDoc(
      `Binds the ${describe(file)} to one transport.\n\n` +
        `Reads as \`${example(namespaces)}\`.`,
    ),
  );
  f.print(f.export("function", `create${name}`), "(transport: ", transport, "): ", name, " {");
  for (const service of servicesOf(namespaces)) {
    f.print(
      "  const ",
      clientVar(service.name),
      " = ",
      createClient,
      "(",
      f.importSchema(service),
      ", transport);",
    );
  }
  f.print("  return {");
  for (const namespace of namespaces) {
    f.print("    ", namespace.name, ": {");
    for (const method of namespace.methods) {
      // Bound rather than wrapped: a wrapper would have to reproduce every
      // overload `createClient` gives a method, and would show up in stack
      // traces without having done anything.
      f.print(
        "      ",
        method.name,
        ": ",
        clientVar(method.desc.parent.name),
        ".",
        method.desc.localName,
        ".bind(",
        clientVar(method.desc.parent.name),
        "),",
      );
    }
    f.print("    },");
  }
  f.print("  };");
  f.print("}");
}

/** Every service behind these namespaces, deduplicated, in first-seen order. */
function servicesOf(namespaces: readonly PlannedNamespace[]) {
  return [...new Set(namespaces.flatMap((namespace) => [...namespace.services]))];
}

/** The local name holding one service's generated client. */
function clientVar(serviceName: string): string {
  return `${serviceName.charAt(0).toLowerCase()}${serviceName.slice(1)}Client`;
}

/**
 * The exported interface name, from the proto package.
 *
 * `sloper.desktop.v1` gives `SloperDesktopClient`. The version is dropped
 * because a client is imported from a versioned path already, and
 * `SloperDesktopV1Client` only repeats it.
 */
function sdkName(file: DescFile): string {
  const parts = file.proto.package.split(".").filter((part) => !/^v\d+(?:[a-z]\w*)?$/v.test(part));
  return `${parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}Client`;
}

function describe(file: DescFile): string {
  return `${file.proto.package} API`;
}

function namespaceDoc(namespace: PlannedNamespace): string {
  const names = namespace.services.map((service) => service.typeName).join(", ");
  return `Methods of ${names}.`;
}

/** A call from the schema itself, so the doc example is one that exists. */
function example(namespaces: readonly PlannedNamespace[]): string {
  const namespace = namespaces[0];
  const method: DescMethod | undefined = namespace?.methods[0]?.desc;
  return namespace === undefined || method === undefined
    ? "client.resources.get(request)"
    : `client.${namespace.name}.${namespaces[0]!.methods[0]!.name}(request)`;
}
