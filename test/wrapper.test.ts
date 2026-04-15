import { describe, expect, it } from "vitest";
import { buildMethodPayload, buildTinkerPayload } from "../src/wrapper";

describe("wrapper", () => {
  it("builds sandboxed selection payload", () => {
    const payload = buildTinkerPayload({
      sandboxEnabled: true,
      fakeStorage: false,
      filePath: "/tmp/demo.php",
      selectionOrFileCode: "return 42;",
    });

    expect(payload).toContain("Mail::fake();");
    expect(payload).toContain("DB::connection");
    expect(payload).toContain("return 42;");
    expect(payload.startsWith("<?php")).toBe(false);
  });

  it("builds method payload with fqcn and prompted args", () => {
    const payload = buildMethodPayload({
      sandboxEnabled: false,
      fakeStorage: false,
      filePath: "/tmp/demo.php",
      promptedArguments: { 1: "'x'" },
      method: {
        namespaceName: "App\\Services",
        className: "ReportRunner",
        fullyQualifiedClassName: "App\\Services\\ReportRunner",
        methodName: "build",
        visibility: "private",
        isStatic: false,
        start: 0,
        end: 10,
        parameters: [],
      },
    });

    expect(payload).toContain("new ReflectionMethod('App\\\\Services\\\\ReportRunner', 'build')");
    expect(payload).toContain("$__toTinkerPromptedArgs = [1 => '\\'x\\''];");
    expect(payload).toContain("setAccessible(true)");
  });
});
