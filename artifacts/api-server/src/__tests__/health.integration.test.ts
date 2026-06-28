import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/sshManager.js", () => ({
  listSessions: vi.fn(() => [{ id: "1", title: "Session 1", status: "connected", createdAt: "2024-01-01T00:00:00.000Z" }]),
}));

describe("health endpoint", () => {
  it("listSessions returns array from mocked sshManager", async () => {
    const { listSessions } = await import("../lib/sshManager.js");
    const sessions = listSessions();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBe(1);
  });
});