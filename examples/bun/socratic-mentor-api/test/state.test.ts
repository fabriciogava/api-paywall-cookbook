import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import fs from "fs";
import { StateManager } from "../src/lib/state.js";

describe("State Manager", () => {
    const TEST_DB = "test.db";

    beforeEach(() => {
        // start fresh
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    });

    afterEach(() => {
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    });

    it("should create database and table on initialization", () => {
        new StateManager(TEST_DB);
        expect(fs.existsSync(TEST_DB)).toBe(true);

        // Use bun:sqlite directly to verify
        const db = new Database(TEST_DB);
        const table = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
        expect(table).toBeDefined();
    });

    it("should save and retrieve state", () => {
        const manager = new StateManager(TEST_DB);
        const id = "session-1";
        const summary = "A summary";
        const history = [{ role: "user" as const, content: "Hi" }];
        const goal = "Learn JS";

        manager.save(id, summary, history, goal);
        const state = manager.get(id);

        expect(state).not.toBeNull();
        expect(state?.id).toBe(id);
        expect(state?.context_state).toBe(summary);
        expect(state?.history).toEqual(history);
        expect(state?.main_goal).toBe(goal);
    });

    it("should update existing state", async () => {
        const manager = new StateManager(TEST_DB);
        const id = "session-update";
        manager.save(id, "Old summary", [], "Old Goal");

        // short delay to ensure updated_at changes (sqlite is fast)
        await new Promise(r => setTimeout(r, 10));

        manager.save(id, "New summary", [{ role: 'user', content: 'new' }] as Array<{ role: 'user' | 'model', content: string }>, "New Goal");
        const state = manager.get(id);

        expect(state?.context_state).toBe("New summary");
        expect(state?.history).toHaveLength(1);
        expect(state?.main_goal).toBe("New Goal");
    });

    it("should return null for non-existent session", () => {
        const manager = new StateManager(TEST_DB);
        expect(manager.get("non-existent")).toBeNull();
    });

    it("should prune old sessions", () => {
        const manager = new StateManager(TEST_DB);

        // Insert records with manual timestamps using raw DB access for testing
        const db = (manager as any).db;

        // 1. Insert an OLD session (1 hour ago)
        db.run(`INSERT INTO sessions (id, context_state, history, main_goal, updated_at) 
                VALUES ('old-session', 'old', '[]', 'goal', datetime('now', '-3600 seconds'))`);

        // 2. Insert a NEW session (now)
        db.run(`INSERT INTO sessions (id, context_state, history, main_goal, updated_at) 
                VALUES ('new-session', 'new', '[]', 'goal', datetime('now'))`);

        // Prune entries older than 30 seconds (old-session is 3600s old, so it dies. new-session is 0s old, it lives)
        const deleted = manager.prune(30);

        expect(deleted).toBe(1);
        expect(manager.get("old-session")).toBeNull();
        expect(manager.get("new-session")).not.toBeNull();
    });
});
