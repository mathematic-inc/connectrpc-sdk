#!/usr/bin/env node

/**
 * The plugin binary.
 *
 * Only the stdio entry point lives here so the plugin itself can be imported
 * without running one; `runNodeJs` reads a request from stdin and would hang
 * a test that merely wanted the generator.
 */

import { runNodeJs } from "@bufbuild/protoplugin";

import { plugin } from "./plugin.js";

runNodeJs(plugin);
