// src/db/database.ts

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

class Database {
    db: sqlite3.Database;

    constructor(dbFilePath: string) {
        this.initialize(dbFilePath);
    }

    async initialize(dbFilePath: string) {
        this.db = await open({
            filename: dbFilePath,
            driver: sqlite3.Database
        });

        await this.createTables();
    }

    async createTables() {
        await this.db.exec(`CREATE TABLE IF NOT EXISTS trades (` +
            `id INTEGER PRIMARY KEY AUTOINCREMENT,` +
            `trade_date TEXT NOT NULL,` +
            `symbol TEXT NOT NULL,` +
            `quantity REAL NOT NULL,` +
            `price REAL NOT NULL,` +
            `exchange TEXT,` +
            `profit REAL DEFAULT 0,` +
            `gas_cost REAL DEFAULT 0,` +
            `status TEXT DEFAULT 'completed',` +
            `type TEXT DEFAULT 'cross-exchange');`);

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

        await this.db.exec(`CREATE TABLE IF NOT EXISTS opportunities (` +
            `id INTEGER PRIMARY KEY AUTOINCREMENT,` +
            `detected_at TEXT NOT NULL,` +
            `symbol TEXT NOT NULL,` +
            `type TEXT NOT NULL,` +
            `expected_profit REAL NOT NULL,` +
            `actual_profit REAL DEFAULT 0,` +
            `gas_cost REAL DEFAULT 0,` +
            `status TEXT NOT NULL DEFAULT 'pending',` +
            `exchange_from TEXT,` +
            `exchange_to TEXT);`);
    }

    async addTrade(tradeData: {
        trade_date: string;
        symbol: string;
        quantity: number;
        price: number;
        exchange?: string;
        profit?: number;
        gas_cost?: number;
        status?: string;
        type?: string;
    }) {
        await this.db.run(
            `INSERT INTO trades (trade_date, symbol, quantity, price, exchange, profit, gas_cost, status, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            tradeData.trade_date,
            tradeData.symbol,
            tradeData.quantity,
            tradeData.price,
            tradeData.exchange ?? null,
            tradeData.profit ?? 0,
            tradeData.gas_cost ?? 0,
            tradeData.status ?? 'completed',
            tradeData.type ?? 'cross-exchange'
        );
    }

    async getTrades(limit = 100, offset = 0) {
        return await this.db.all(`SELECT * FROM trades ORDER BY trade_date DESC LIMIT ? OFFSET ?`, limit, offset);
    }

    async addOpportunity(data: {
        detected_at: string;
        symbol: string;
        type: string;
        expected_profit: number;
        actual_profit?: number;
        gas_cost?: number;
        status?: string;
        exchange_from?: string;
        exchange_to?: string;
    }) {
        await this.db.run(
            `INSERT INTO opportunities (detected_at, symbol, type, expected_profit, actual_profit, gas_cost, status, exchange_from, exchange_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            data.detected_at,
            data.symbol,
            data.type,
            data.expected_profit,
            data.actual_profit ?? 0,
            data.gas_cost ?? 0,
            data.status ?? 'pending',
            data.exchange_from ?? null,
            data.exchange_to ?? null
        );
    }

    async getOpportunities(limit = 100, offset = 0) {
        return await this.db.all(`SELECT * FROM opportunities ORDER BY detected_at DESC LIMIT ? OFFSET ?`, limit, offset);
    }

    async getStats(period: 'daily' | 'weekly' | 'monthly') {
        const periodDaysMap: Record<string, number> = {
            daily: 1,
            weekly: 7,
            monthly: 30,
        };
        const days = periodDaysMap[period];
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        return await this.db.get(
            `SELECT
                COUNT(*) as total_trades,
                SUM(profit) as total_profit,
                SUM(gas_cost) as total_gas_cost,
                AVG(profit) as avg_profit,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_trades,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_trades
             FROM trades WHERE trade_date >= ?`,
            since
        );
    }

    async getOpportunityStats() {
        return await this.db.get(
            `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed,
                SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                AVG(expected_profit) as avg_expected_profit,
                AVG(actual_profit) as avg_actual_profit
             FROM opportunities`
        );
    }

    async getPerformanceMetrics() {
        return await this.db.all(`SELECT * FROM performance_metrics ORDER BY timestamp DESC LIMIT 100`);
    }

    async close() {
        await this.db.close();
    }
}

export default Database;
