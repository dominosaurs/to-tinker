export const COMMANDS = {
  runSelection: "toTinker.runSelection",
  runSelectionDisableSandbox: "toTinker.runSelectionDisableSandbox",
  runFile: "toTinker.runFile",
  runFileDisableSandbox: "toTinker.runFileDisableSandbox",
  runMethod: "toTinker.runMethod",
  runMethodDisableSandbox: "toTinker.runMethodDisableSandbox",
} as const;

export type CommandName = keyof typeof COMMANDS;

export type RunKind = "selection" | "file" | "method";
