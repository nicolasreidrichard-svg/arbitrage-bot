// src/db/database.ts

import sqlite3 from 'sqlite3';
import { open, Database as SqliteDatabase } from 'sqlite';

class Database {
    private db!: SqliteDatabase<sqlite3.Database, sqlite3.Statement>;

    constructor(dbFilePath: string) {
        this.initialize(dbFilePath);
    }

    async initialize(dbFilePath: string): Promise<void> {
        this.db = await open({
            filename: dbFilePath,
            driver: sqlite3.Database
        });

        await this.createTables();
    }

    async createTables(): Promise<void> {
        await this.db.exec(`CREATE TABLE IF NOT EXISTS trades (` +
            `id INTEGER PRIMARY KEY AUTOINCREMENT,` +
            `trade_date TEXT NOT NULL,` +
            `symbol TEXT NOT NULL,` +
            `quantity REAL NOT NULL,` +
            `price REAL NOT NULL);`);

        await this.db.exec(`CREATE TABLE IF NOT EXISTS prices (` +
            `id INTEGER PRIMARY KEY AUTOINCREMENT,` +
            `symbol TEXT NOT NULL,` +
            `price REAL NOT NULL,` +
            `timestamp TEXT NOT NULL);`);

        await this.db.exec(`CREATE TABLE IF NOT EXISTS performance_metrics (` +
            `id INTEGER PRIMARY KEY AUTOINCREMENT,` +
            `metric_name TEXT NOT NULL,` +
            `value REAL NOT NULL,` +
            `timestamp TEXT NOT NULL);`);
    }

    async addTrade(tradeData: { trade_date: string; symbol: string; quantity: number; price: number }): Promise<void> {
        await this.db.run(`INSERT INTO trades (trade_date, symbol, quantity, price) VALUES (?, ?, ?, ?)`,
            tradeData.trade_date, tradeData.symbol, tradeData.quantity, tradeData.price);
    }

    async getTrades(): Promise<unknown[]> {
        return this.db.all(`SELECT * FROM trades`);
    }

    async close(): Promise<void> {
        await this.db.close();
    }
}

export default Database;