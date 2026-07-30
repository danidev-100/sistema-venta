import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Store — dashboard default page", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("1.1 — default page should be pos", async () => {
    // Use dynamic import to get a fresh store instance with the current default
    const { useAppStore } = await import("@/store");
    expect(useAppStore.getState().page).toBe("pos");
  });

  it("1.1 — setPage works with pos target", async () => {
    const { useAppStore } = await import("@/store");
    useAppStore.getState().setPage("pos");
    expect(useAppStore.getState().page).toBe("pos");
  });
});
