import { describe, it, expect } from "vitest";
import { toSnake } from "@/lib/apiClient";

describe("apiClient toSnake", () => {
  it("converts nested camelCase keys for .NET snake_case JSON", () => {
    expect(
      toSnake({
        productId: "p1",
        storyPoints: 3,
        nested: { failReason: "x" },
      }),
    ).toEqual({
      product_id: "p1",
      story_points: 3,
      nested: { fail_reason: "x" },
    });
  });

  it("leaves already snake_case keys unchanged", () => {
    expect(
      toSnake({
        product_id: "p1",
        release_notes: "hi",
      }),
    ).toEqual({
      product_id: "p1",
      release_notes: "hi",
    });
  });
});
