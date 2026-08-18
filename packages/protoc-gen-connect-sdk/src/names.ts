/**
 * The naming rules both generators share.
 *
 * A Connect schema names methods so they stand alone: `CreateWorkspace` says
 * what it creates because nothing around it does. An SDK groups those methods
 * under a namespace that already says it, so the name repeats itself —
 * `workspaces.createWorkspace`. These rules remove the repetition and leave
 * `workspaces.create`.
 *
 * Everything here works on camel-case words rather than raw substrings. That
 * distinction is the difference between `AccountService.ListAccountingPeriods`
 * deriving `listAccountingPeriods` and deriving `listingPeriods`.
 */

import pluralize from "pluralize";

/** Splits an identifier into its words, lower-cased. */
export function words(name: string): string[] {
  return (
    name
      // `ExportRunID` splits after `Run` and keeps `ID` whole.
      .replace(/([a-z0-9])([A-Z])/gv, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/gv, "$1 $2")
      .split(/[\s_]+/v)
      .filter((word) => word !== "")
      .map((word) => word.toLowerCase())
  );
}

/** Joins words as lower camel case, the casing every derived name is stored in. */
export function lowerCamel(parts: readonly string[]): string {
  return parts
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

/**
 * The namespace a service's methods group under.
 *
 * `WorkspaceService` gives `workspaces`, and `AgentSetupService` gives
 * `agentSetups` — plural because a namespace holds a collection, and the
 * pluralized last word because that is the resource the service is named for.
 *
 * Pluralization comes from `pluralize`, so the irregular resources English
 * actually has — `person`, `child`, `status` — come out right rather than
 * needing an override each.
 */
export function namespaceFor(serviceName: string, override?: string): string {
  if (override !== undefined && override !== "") {
    return override;
  }
  const parts = words(serviceName);
  if (parts.at(-1) === "service") {
    parts.pop();
  }
  const last = parts.pop();
  return last === undefined ? "service" : lowerCamel([...parts, pluralize.plural(last)]);
}

/**
 * The name a method takes inside its namespace.
 *
 * The leading verb is split off first, then the resource the namespace
 * already names is removed from what follows: `ListWorkspaces` leaves `list`,
 * and `ApproveExport` leaves `approve`.
 *
 * Only a leading occurrence is removed, so `ListEntityExports` — which lists
 * the exports *of an entity* rather than a collection of entities — keeps
 * every word. Removing the resource wherever it appeared would name that
 * method `listEntity`, which reads as listing entities.
 *
 * A method naming no resource keeps all its words, because there is nothing
 * to remove: `SetDraftMode` stays `setDraftMode`.
 */
export function methodFor(methodName: string, namespace: string, override?: string): string {
  if (override !== undefined && override !== "") {
    return override;
  }
  const parts = words(methodName);
  const verb = parts.shift();
  if (verb === undefined) {
    return lowerCamel(words(methodName));
  }

  const resource = words(namespace);
  const last = resource.pop();
  // A namespace is plural, so a method naming one member of it is singular:
  // `workspaces` matches both `ListWorkspaces` and `GetWorkspace`.
  const forms =
    last === undefined
      ? []
      : [...new Set([last, pluralize.singular(last)])].map((form) => [...resource, form]);

  for (const form of forms) {
    if (startsWithWords(parts, form)) {
      const rest = parts.slice(form.length);
      // `ListWorkspaces` reduces to the bare verb; anything left joins it.
      return lowerCamel([verb, ...rest]);
    }
  }
  return lowerCamel([verb, ...parts]);
}

/** Whether `parts` begins with every word of `prefix`, compared word by word. */
function startsWithWords(parts: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length > 0 && prefix.every((word, index) => parts[index] === word);
}
