/**
 * Phase 11 Plan 01 — buildWebpFormatEntry pure format-object builder (D-03).
 *
 * These tests exercise ONLY the pure shape-construction logic of
 * `buildWebpFormatEntry`. No fs/network I/O, no sharp — sharp usage lives in
 * strapi-server.ts (Task 3), not here (see acceptance criteria).
 */

import { describe, expect, it } from "vitest";
import { buildWebpFormatEntry } from "../webp-format";

describe("buildWebpFormatEntry", () => {
  it("Test 1: returns a format object shaped like resizeFileTo's return value", () => {
    const source = { name: "hero.png", hash: "abc123", width: 1600, height: 900 };
    const buffer = Buffer.alloc(5000);

    const result = buildWebpFormatEntry(source, buffer);

    expect(result.name).toBe("hero.webp");
    expect(result.hash).toBe("abc123_webp");
    expect(result.ext).toBe(".webp");
    expect(result.mime).toBe("image/webp");
    expect(result.width).toBe(1600);
    expect(result.height).toBe(900);
    expect(result.path).toBeNull();
    expect(typeof result.getStream).toBe("function");
  });

  it("Test 2: size is buffer length in KB (rounded to 2 decimals); sizeInBytes is the raw length", () => {
    const source = { name: "hero.png", hash: "abc123", width: 1600, height: 900 };
    const buffer = Buffer.alloc(5000);

    const result = buildWebpFormatEntry(source, buffer);

    expect(result.size).toBe(Math.round((buffer.length / 1024) * 100) / 100);
    expect(result.sizeInBytes).toBe(buffer.length);
  });

  it("Test 3: appends .webp (no double-dot) when the source name has no extension", () => {
    const source = { name: "logo", hash: "def456", width: 200, height: 100 };
    const buffer = Buffer.alloc(1234);

    const result = buildWebpFormatEntry(source, buffer);

    expect(result.name).toBe("logo.webp");
  });

  it("Test 4: never throws and never invents dimensions when width/height are undefined", () => {
    const source = { name: "mystery.jpg", hash: "ghi789" };
    const buffer = Buffer.alloc(10);

    const result = buildWebpFormatEntry(source, buffer);

    expect(result.width).toBeUndefined();
    expect(result.height).toBeUndefined();
  });
});
