import { describe, expect, test } from "vitest";

import { methodFor, namespaceFor } from "./names.js";

describe("namespaceFor", () => {
  test.for([
    ["WorkspaceService", "workspaces"],
    ["EntityService", "entities"],
    ["ExportService", "exports"],
    ["EventService", "events"],
    ["AccountService", "accounts"],
    ["AgentSetupService", "agentSetups"],
    ["DevService", "devs"],
    // Pluralization runs on the last word only, since that is the resource.
    ["ExportRunService", "exportRuns"],
    ["CompanyService", "companies"],
    ["AddressService", "addresses"],
    ["BatchService", "batches"],
    // Already plural, so it is left alone rather than doubled.
    ["AnalyticsService", "analytics"],
    // A service named without the suffix still names its resource.
    ["Greeter", "greeters"],
  ])("%s -> %s", ([service, expected]) => {
    expect(namespaceFor(service!)).toBe(expected);
  });

  test("an override replaces a plural the rule gets wrong", () => {
    expect(namespaceFor("PersonService", "people")).toBe("people");
  });
});

describe("methodFor", () => {
  test.for([
    // The namespace names the resource, so the method drops it.
    ["ListWorkspaces", "workspaces", "list"],
    ["CreateWorkspace", "workspaces", "create"],
    ["GetEntity", "entities", "get"],
    ["ListEntities", "entities", "list"],
    ["ApproveExport", "exports", "approve"],
    ["ExportWorkspaces", "workspaces", "export"],
    // What remains after the resource joins the verb.
    ["GetWorkspaceOverview", "workspaces", "getOverview"],
    ["ListEntityRevisions", "entities", "listRevisions"],
    ["GetAccountStatus", "accounts", "getStatus"],
    ["ActivateAccount", "accounts", "activate"],
    ["GetAgentSetupStatus", "agentSetups", "getStatus"],
    ["ListExportRuns", "exports", "listRuns"],
    ["GetExportRun", "exports", "getRun"],
    ["WatchExportRun", "exports", "watchRun"],
    // Names no resource, so nothing is removed.
    ["SetDraftMode", "workspaces", "setDraftMode"],
    ["CreateCheckpoint", "workspaces", "createCheckpoint"],
    ["DiscardChanges", "workspaces", "discardChanges"],
    ["RestoreCheckpoint", "workspaces", "restoreCheckpoint"],
    ["ListComputations", "workspaces", "listComputations"],
    ["GetApplicationState", "workspaces", "getApplicationState"],
    ["BeginLogin", "accounts", "beginLogin"],
    ["WatchLogin", "accounts", "watchLogin"],
    ["ListBillingOwners", "accounts", "listBillingOwners"],
    ["ClearSession", "accounts", "clearSession"],
    ["OpenBilling", "accounts", "openBilling"],
    ["RefreshAccount", "accounts", "refresh"],
    ["InstallAgentSkill", "agentSetups", "installAgentSkill"],
    ["SubscribeEvents", "events", "subscribe"],
    ["ShutdownDesktop", "devs", "shutdownDesktop"],
    // The resource appears, but not first: these list the exports of an
    // entity, so removing it would name them `listEntity` and `getEntity`.
    ["ListEntityExports", "exports", "listEntityExports"],
    ["GetWorkspaceExport", "exports", "getWorkspaceExport"],
  ])("%s in %s -> %s", ([method, namespace, expected]) => {
    expect(methodFor(method!, namespace!)).toBe(expected);
  });

  test("matches whole words, not substrings", () => {
    // `Accounting` starts with `account`; a substring match would leave
    // `listingPeriods`.
    expect(methodFor("ListAccountingPeriods", "accounts")).toBe("listAccountingPeriods");
  });

  test("an override replaces the derived name", () => {
    expect(methodFor("ListEntityExports", "exports", "listForEntity")).toBe("listForEntity");
  });
});
