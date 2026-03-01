// src/api/dashboardRouter.ts

import { Router, Request, Response } from 'express';
import Database from '../db/database';
import logger from '../utils/logger';

const DB_PATH = process.env.DB_PATH || './arbitrage.db';

let db: Database | null = null;

function getDb(): Database {
    if (!db) {
        db = new Database(DB_PATH);
    }
    return db;
}

const router = Router();

// GET /trades - Paginated trade history
router.get('/trades', async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
        const offset = parseInt(req.query.offset as string) || 0;
        const trades = await getDb().getTrades(limit, offset);
        res.json({ trades, limit, offset });
    } catch (err) {
        logger.error(`GET /trades error: ${err}`);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// GET /stats - Profitability statistics (daily, weekly, monthly)
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const period = (req.query.period as string) || 'daily';
        if (!['daily', 'weekly', 'monthly'].includes(period)) {
            res.status(400).json({ error: 'Invalid period. Use daily, weekly, or monthly.' });
            return;
        }
        const stats = await getDb().getStats(period as 'daily' | 'weekly' | 'monthly');
        res.json({ period, stats });
    } catch (err) {
        logger.error(`GET /stats error: ${err}`);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /performance - Bot performance metrics
router.get('/performance', async (req: Request, res: Response) => {
    try {
        const metrics = await getDb().getPerformanceMetrics();
        const [daily, weekly, monthly] = await Promise.all([
            getDb().getStats('daily'),
            getDb().getStats('weekly'),
            getDb().getStats('monthly'),
        ]);
        res.json({
            metrics,
            summary: { daily, weekly, monthly },
        });
    } catch (err) {
        logger.error(`GET /performance error: ${err}`);
        res.status(500).json({ error: 'Failed to fetch performance data' });
    }
});

// GET /opportunities - Opportunity success/failure rates
router.get('/opportunities', async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
        const offset = parseInt(req.query.offset as string) || 0;
        const [opportunities, opportunityStats] = await Promise.all([
            getDb().getOpportunities(limit, offset),
            getDb().getOpportunityStats(),
        ]);
        res.json({ opportunities, stats: opportunityStats, limit, offset });
    } catch (err) {
        logger.error(`GET /opportunities error: ${err}`);
        res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
});

export default router;
