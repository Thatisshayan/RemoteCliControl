import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("fs");
vi.mock("path");

import { getActiveConnection, getConnections, addConnection, removeConnection, setActiveConnection, getCommands, addCommand, removeCommand } from "../store.js";

describe("store.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("getActiveConnection returns null when no active connection", async () => {
    const { getActiveConnection } = await import("../store.js");
    expect(getActiveConnection()).toBeNull();
  });

  it("addConnection and getConnections maintain array correctly", async () => {
    const { addConnection, getConnections, getActiveConnection, setActiveConnection } = await import("../store.js");
    
    const profile = addConnection({ 
      name: "test", 
      host: "localhost", 
      port: 22, 
      username: "user", 
      password: "pass" 
    });
    
    expect(profile.name).toBe("test");
    expect(profile.host).toBe("localhost");
    expect(profile.id).toBeDefined();
    
    const connections = getConnections();
    expect(connections.length).toBe(1);
    expect(connections[0].id).toBe(profile.id);
    
    const active = getActiveConnection();
    expect(active?.id).toBe(profile.id);
  });

  it("removeConnection removes and updates active connection", async () => {
    const { addConnection, removeConnection, getConnections, getActiveConnection, setActiveConnection } = await import("../store.js");
    
    const p1 = addConnection({ name: "p1", host: "h1", port: 22, username: "u", password: "p" });
    const p2 = addConnection({ name: "p2", host: "h2", port: 22, username: "u", password: "p" });
    
    expect(getConnections().length).toBe(2);
    
    const removed = removeConnection(p1.id);
    expect(removed).toBe(true);
    expect(getConnections().length).toBe(1);
    expect(getConnections()[0].id).toBe(p2.id);
    
    const active = getActiveConnection();
    expect(active?.id).toBe(p2.id);
  });

  it("addCommand and removeCommand maintain array correctly", async () => {
    const { addCommand, removeCommand, getCommands } = await import("../store.js");
    
    const cmd = addCommand("test", "echo hello", "desc");
    expect(cmd.label).toBe("test");
    expect(cmd.command).toBe("echo hello");
    expect(cmd.description).toBe("desc");
    expect(cmd.id).toBeDefined();
    
    const commands = getCommands();
    expect(commands.length).toBe(1);
    expect(commands[0].id).toBe(cmd.id);
    
    const removed = removeCommand(cmd.id);
    expect(removed).toBe(true);
    expect(getCommands().length).toBe(0);
  });

  it("IDs are unique", async () => {
    const { addCommand, getCommands } = await import("../store.js");
    
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const cmd = addCommand(`label${i}`, `cmd${i}`);
      expect(ids.has(cmd.id)).toBe(false);
      ids.add(cmd.id);
    }
    expect(ids.size).toBe(100);
  });
});