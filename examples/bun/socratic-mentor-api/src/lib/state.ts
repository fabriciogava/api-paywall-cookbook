import { Database } from "bun:sqlite";
import { validateWalletAddress, validateSignatureHash, validateBalanceAmount } from "./validation.js";

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

        this.db.run(`CREATE TABLE IF NOT EXISTS balances (
        wallet_address TEXT PRIMARY KEY,
        balance_atomic TEXT NOT NULL
      )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS processed_payments (
        signature_hash TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
     * Ledger Methods
     */

    getBalance(walletAddress: string): bigint {
        // Validate wallet address to prevent SQL injection
        validateWalletAddress(walletAddress);

        const row = this.db.query<{ balance_atomic: string }, any>("SELECT balance_atomic FROM balances WHERE wallet_address = ?").get(walletAddress);
        return row ? BigInt(row.balance_atomic) : 0n;
    }

    /**
     * Atomically adjusts the balance by the given delta.
     * Use positive delta to credit, negative to debit (blindly).
     */
    adjustBalance(walletAddress: string, delta: bigint) {
        // Validate inputs to prevent SQL injection and integer overflow
        validateWalletAddress(walletAddress);
        validateBalanceAmount(delta < 0n ? -delta : delta, "delta");

        // Get current balance to perform bounds checking
        const currentBalance = this.getBalance(walletAddress);
        const newBalance = currentBalance + delta;

        // Validate the new balance is within acceptable bounds
        if (newBalance < 0n) {
            throw new Error("Balance cannot be negative after adjustment");
        }
        validateBalanceAmount(newBalance, "new balance");

        // Use parameterized query to prevent SQL injection
        // Convert to string for TEXT storage as requested
        const deltaStr = delta.toString();
        this.db.prepare(`
            INSERT INTO balances (wallet_address, balance_atomic)
            VALUES (?, ?)
            ON CONFLICT(wallet_address) DO UPDATE SET
                balance_atomic = CAST(CAST(balance_atomic AS BIGINT) + ? AS TEXT)
        `).run(walletAddress, deltaStr, deltaStr);
    }

    /**
     * Atomically deducts amount ONLY if sufficient balance exists.
     * Returns true if deduction occurred, false otherwise.
     */
    deductBalance(walletAddress: string, amount: bigint): boolean {
        // Validate inputs to prevent SQL injection and invalid amounts
        validateWalletAddress(walletAddress);
        validateBalanceAmount(amount, "deduction amount");

        // Use parameterized query to prevent SQL injection
        // The WHERE clause ensures we only deduct if sufficient balance exists
        const amountStr = amount.toString();
        const result = this.db.prepare(`
            UPDATE balances
            SET balance_atomic = CAST(CAST(balance_atomic AS BIGINT) - ? AS TEXT)
            WHERE wallet_address = ? AND CAST(balance_atomic AS BIGINT) >= ?
        `).run(amountStr, walletAddress, amountStr);

        return result.changes > 0;
    }

    getPayment(signatureHash: string): { wallet_address: string } | null {
        // Validate signature hash to prevent SQL injection
        validateSignatureHash(signatureHash);

        return this.db.query<{ wallet_address: string }, any>("SELECT wallet_address FROM processed_payments WHERE signature_hash = ?").get(signatureHash) || null;
    }

    recordPayment(signatureHash: string, walletAddress: string) {
        // Validate both inputs to prevent SQL injection
        validateSignatureHash(signatureHash);
        validateWalletAddress(walletAddress);

        this.db.prepare(`
            INSERT INTO processed_payments (signature_hash, wallet_address)
            VALUES (?, ?)
        `).run(signatureHash, walletAddress);
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

    /**
     * Deletes processed payment records older than the specified seconds,
     * but ONLY if the associated wallet has zero balance.
     * 
     * This ensures:
     * 1. We don't lose identity for wallets that still have funds
     * 2. Old records are cleaned up for DB hygiene
     * 3. Records are kept for customer service (minimum 90 days recommended)
     * 
     * @param maxAgeSeconds - Minimum age of records to prune (default 90 days)
     * @returns Number of deleted rows
     */
    prunePayments(maxAgeSeconds: number): number {
        // Only delete payments where:
        // 1. The payment is older than maxAgeSeconds
        // 2. The wallet has NO balance (balance = 0 or not in balances table)
        const stmt = this.db.prepare(`
            DELETE FROM processed_payments 
            WHERE created_at < datetime('now', '-' || ? || ' seconds')
            AND wallet_address NOT IN (
                SELECT wallet_address FROM balances 
                WHERE CAST(balance_atomic AS BIGINT) > 0
            )
        `);
        const result = stmt.run(maxAgeSeconds);
        return result.changes;
    }

    /**
     * Closes the database connection for graceful shutdown.
     */
    close() {
        this.db.close();
    }
}

// Factory function
export function createStateManager(dbPath: string = "socratic.db") {
    return new StateManager(dbPath);
}
