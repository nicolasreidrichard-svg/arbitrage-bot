// shop-monitor.ts
// Agent that monitors duenorthlingerie.com shop activity.
// It polls the shop for current order/view metrics, detects when pending orders
// exceed the configured backlog threshold, and surfaces a prioritised work list
// so the owner can catch up during busy periods.

import axios from 'axios';
import logger from '../utils/logger';
import businessConfig from '../config/business-config';

export interface ShopMetrics {
    pendingOrders: number;
    viewsToday: number;
    /** ISO-8601 datetime of the most recent order */
    latestOrderAt?: string;
    fetchedAt: Date;
}

export interface OrderSummary {
    orderId: string;
    customerName: string;
    items: number;
    totalAmount: number;
    /** ISO-8601 datetime */
    placedAt: string;
    status: 'pending' | 'processing' | 'shipped' | 'completed';
    priority: 'high' | 'normal';
}

export interface BacklogReport {
    isBacklogged: boolean;
    pendingOrders: number;
    threshold: number;
    priorityOrders: OrderSummary[];
    generatedAt: Date;
}

class ShopMonitor {
    private shopUrl: string;
    private backlogThreshold: number;
    private pollIntervalMs: number;
    private apiTimeoutMs: number;
    private pollTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.shopUrl = businessConfig.shop.shopUrl;
        this.backlogThreshold = businessConfig.shop.backlogThreshold;
        this.pollIntervalMs = businessConfig.shop.pollIntervalMs;
        this.apiTimeoutMs = businessConfig.shop.apiTimeoutMs;
    }

    /**
     * Start periodic monitoring.  On each tick the agent fetches metrics and
     * logs a backlog alert when pending orders breach the threshold.
     */
    start(): void {
        if (this.pollTimer) return; // already running
        logger.log(`[ShopMonitor] Starting – polling ${this.shopUrl} every ${this.pollIntervalMs}ms`);
        this.pollTimer = setInterval(() => void this.poll(), this.pollIntervalMs);
        // Run an immediate first check
        void this.poll();
    }

    stop(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
            logger.log('[ShopMonitor] Stopped');
        }
    }

    private async poll(): Promise<void> {
        try {
            const metrics = await this.fetchMetrics();
            if (metrics.pendingOrders >= this.backlogThreshold) {
                logger.warn(
                    `[ShopMonitor] Backlog alert: ${metrics.pendingOrders} pending orders (threshold: ${this.backlogThreshold}) on ${this.shopUrl}`
                );
            } else {
                logger.log(
                    `[ShopMonitor] OK – ${metrics.pendingOrders} pending orders, ${metrics.viewsToday} views today`
                );
            }
        } catch (error) {
            logger.error(`[ShopMonitor] Poll failed: ${error}`);
        }
    }

    /**
     * Fetch current shop metrics.
     *
     * The integration expects the shop API to expose a `/metrics` endpoint that
     * returns JSON with the shape of {@link ShopMetrics}.  When the endpoint is
     * unavailable (e.g. during local development) sensible defaults are returned
     * so the rest of the agent logic can still be exercised.
     */
    async fetchMetrics(): Promise<ShopMetrics> {
        const metricsUrl = `${this.shopUrl.replace(/\/$/, '')}/api/metrics`;

        try {
            const response = await axios.get<ShopMetrics>(metricsUrl, { timeout: this.apiTimeoutMs });
            const data = response.data;
            return {
                pendingOrders: data.pendingOrders ?? 0,
                viewsToday: data.viewsToday ?? 0,
                latestOrderAt: data.latestOrderAt,
                fetchedAt: new Date(),
            };
        } catch {
            // Shop API not reachable – return zeros so callers can handle gracefully.
            logger.warn(`[ShopMonitor] Could not reach ${metricsUrl} – returning empty metrics`);
            return { pendingOrders: 0, viewsToday: 0, fetchedAt: new Date() };
        }
    }

    /**
     * Build a backlog report from a list of orders, marking those placed earliest
     * as high priority so the owner knows where to start.
     */
    buildBacklogReport(orders: OrderSummary[]): BacklogReport {
        const pending = orders.filter((o) => o.status === 'pending' || o.status === 'processing');

        // The oldest pending orders get high priority
        const sorted = [...pending].sort(
            (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
        );
        const cutoff = Math.min(5, sorted.length);
        const priorityOrders = sorted.slice(0, cutoff).map((o) => ({ ...o, priority: 'high' as const }));

        return {
            isBacklogged: pending.length >= this.backlogThreshold,
            pendingOrders: pending.length,
            threshold: this.backlogThreshold,
            priorityOrders,
            generatedAt: new Date(),
        };
    }

    /**
     * Log a human-readable summary of the backlog report.
     */
    logBacklogReport(report: BacklogReport): void {
        if (!report.isBacklogged) {
            logger.log(`[ShopMonitor] No backlog – ${report.pendingOrders}/${report.threshold} orders pending`);
            return;
        }

        logger.warn(
            `[ShopMonitor] BACKLOG – ${report.pendingOrders} orders pending (threshold: ${report.threshold})`
        );
        logger.warn('[ShopMonitor] Priority orders to action first:');
        for (const order of report.priorityOrders) {
            logger.warn(
                `  #${order.orderId} | ${order.customerName} | ${order.items} items | $${order.totalAmount.toFixed(2)} | placed ${order.placedAt}`
            );
        }
    }
}

export default ShopMonitor;
