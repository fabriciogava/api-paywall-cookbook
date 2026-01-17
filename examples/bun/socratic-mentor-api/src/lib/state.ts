import { Database } from "bun:sqlite";

export interface SessionState {
    id: string;
    context_state: string; // The summary
    history: Array<{ role: 'user' | 'model', content: string }>;
    main_goal: string;
    updated_at: string;
}

interface SessionRow {
    id: string;
    context_state: string;
    history: string;
    main_goal: string;
    updated_at: string;
}

export class StateManager {
    private db: Database;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.initialize();
    }

    private initialize() {
        this.db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        context_state TEXT NOT NULL,
        history TEXT DEFAULT '[]',
        main_goal TEXT DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    }

    get(id: string): SessionState | null {
        const row = this.db.query("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | null;
        if (!row) return null;
        return {
            ...row,
            history: JSON.parse(row.history || '[]'),
        };
    }

    save(id: string, contextState: string, history: Array<{ role: 'user' | 'model', content: string }>, mainGoal: string) {
        const stmt = this.db.prepare(`
        INSERT INTO sessions (id, context_state, history, main_goal, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            context_state = excluded.context_state,
            history = excluded.history,
            main_goal = excluded.main_goal,
            updated_at = excluded.updated_at
        `);
        stmt.run(id, contextState, JSON.stringify(history), mainGoal);
    }

    /**
     * Deletes sessions older than the specified seconds.
     * @returns Number of deleted rows
     */
    prune(maxAgeSeconds: number): number {
        // SQLite datetime('now', '-X seconds')
        const stmt = this.db.prepare(`
            DELETE FROM sessions 
            WHERE updated_at < datetime('now', '-' || ? || ' seconds')
        `);
        const result = stmt.run(maxAgeSeconds);
        return result.changes;
    }
}

// Factory function
export function createStateManager(dbPath: string = "socratic.db") {
    return new StateManager(dbPath);
}
