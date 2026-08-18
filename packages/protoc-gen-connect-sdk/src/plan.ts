/**
 * The shape an SDK takes, read once from the schema.
 *
 * Both generators answer the same question — which methods land in which
 * namespace, and under what name — so they read it here rather than each
 * walking the descriptors and drifting apart.
 */

import { getExtension, hasExtension, type DescMethod, type DescService } from "@bufbuild/protobuf";

import { method as methodOption, namespace as namespaceOption } from "./gen/connectsdk/v1/annotations_pb.js";
import { methodFor, namespaceFor } from "./names.js";

/** One RPC, under the name it takes in the SDK. */
export interface PlannedMethod {
  /** Name within the namespace, in lower camel case. */
  readonly name: string;
  /** The RPC this delegates to. */
  readonly desc: DescMethod;
}

/** One namespace and the methods reached through it. */
export interface PlannedNamespace {
  /** Property name on the client, in lower camel case. */
  readonly name: string;
  /**
   * Services contributing methods, in schema order.
   *
   * More than one when several services declare the same namespace, which is
   * how a schema presents one surface that it implements as several services.
   */
  readonly services: readonly DescService[];
  readonly methods: readonly PlannedMethod[];
}

/**
 * Groups services into the namespaces an SDK exposes.
 *
 * Namespaces come out in the order their first service appears, so a schema's
 * own ordering survives into the generated client.
 */
export function planNamespaces(services: readonly DescService[]): PlannedNamespace[] {
  const plan = new Map<string, { services: DescService[]; methods: PlannedMethod[] }>();
  for (const service of services) {
    const options = service.proto.options;
    const name = namespaceFor(
      service.name,
      options !== undefined && hasExtension(options, namespaceOption)
        ? getExtension(options, namespaceOption)
        : undefined,
    );
    const entry = plan.get(name) ?? { services: [], methods: [] };
    entry.services.push(service);
    for (const desc of service.methods) {
      const methodOptions = desc.proto.options;
      entry.methods.push({
        name: methodFor(
          desc.name,
          name,
          methodOptions !== undefined && hasExtension(methodOptions, methodOption)
            ? getExtension(methodOptions, methodOption)
            : undefined,
        ),
        desc,
      });
    }
    plan.set(name, entry);
  }
  return [...plan].map(([name, entry]) => ({ name, ...entry }));
}

/**
 * Reports a name two methods in one namespace both answer to.
 *
 * Distinct RPCs can derive the same name — `GetWorkspace` and
 * `GetWorkspaces` both reduce to `get` — and the generated client would
 * silently keep whichever came last. Callers surface this as an error telling
 * the schema to set an override.
 */
export function findCollision(namespace: PlannedNamespace): string | undefined {
  const seen = new Set<string>();
  for (const method of namespace.methods) {
    if (seen.has(method.name)) {
      return method.name;
    }
    seen.add(method.name);
  }
  return undefined;
}
