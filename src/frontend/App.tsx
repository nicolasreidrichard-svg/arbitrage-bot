// src/frontend/App.tsx
import React, { useEffect, useState } from 'react';

const API_BASE = '/api';

interface Trade {
    id: number;
    trade_date: string;
    symbol: string;
    quantity: number;
    price: number;
    exchange: string;
    profit: number;
    gas_cost: number;
    status: string;
    type: string;
}

interface Opportunity {
    id: number;
    detected_at: string;
    symbol: string;
    type: string;
    expected_profit: number;
    actual_profit: number;
    gas_cost: number;
    status: string;
    exchange_from: string;
    exchange_to: string;
}

interface Stats {
    total_trades: number;
    total_profit: number;
    total_gas_cost: number;
    avg_profit: number;
    successful_trades: number;
    failed_trades: number;
}

interface OpportunityStats {
    total: number;
    executed: number;
    skipped: number;
    failed: number;
    avg_expected_profit: number;
    avg_actual_profit: number;
}

const styles: Record<string, React.CSSProperties> = {
    app: { minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', padding: '24px' },
    header: { borderBottom: '1px solid #2d3748', paddingBottom: '16px', marginBottom: '24px' },
    title: { fontSize: '28px', fontWeight: 700, color: '#63b3ed' },
    subtitle: { fontSize: '14px', color: '#718096', marginTop: '4px' },
    tabs: { display: 'flex', gap: '8px', marginBottom: '24px' },
    tab: { padding: '8px 20px', borderRadius: '6px', border: '1px solid #2d3748', background: '#1a202c', color: '#a0aec0', cursor: 'pointer', fontSize: '14px' },
    activeTab: { padding: '8px 20px', borderRadius: '6px', border: '1px solid #63b3ed', background: '#2b6cb0', color: '#fff', cursor: 'pointer', fontSize: '14px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' },
    card: { background: '#1a202c', border: '1px solid #2d3748', borderRadius: '8px', padding: '16px' },
    cardLabel: { fontSize: '12px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' },
    cardValue: { fontSize: '28px', fontWeight: 700, marginTop: '8px' },
    positive: { color: '#68d391' },
    negative: { color: '#fc8181' },
    neutral: { color: '#63b3ed' },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
    th: { textAlign: 'left' as const, padding: '10px 12px', background: '#1a202c', color: '#718096', borderBottom: '1px solid #2d3748', fontWeight: 600 },
    td: { padding: '10px 12px', borderBottom: '1px solid #1a202c', verticalAlign: 'top' as const },
    tableWrapper: { background: '#171923', border: '1px solid #2d3748', borderRadius: '8px', overflow: 'hidden' },
    periodSelector: { display: 'flex', gap: '8px', marginBottom: '16px' },
    periodBtn: { padding: '4px 14px', borderRadius: '4px', border: '1px solid #2d3748', background: '#1a202c', color: '#a0aec0', cursor: 'pointer', fontSize: '13px' },
    activePeriodBtn: { padding: '4px 14px', borderRadius: '4px', border: '1px solid #63b3ed', background: '#2b6cb0', color: '#fff', cursor: 'pointer', fontSize: '13px' },
    loading: { textAlign: 'center' as const, padding: '40px', color: '#718096' },
    error: { background: '#742a2a', border: '1px solid #fc8181', borderRadius: '6px', padding: '12px 16px', color: '#fc8181', marginBottom: '16px' },
    sectionTitle: { fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#e2e8f0' },
};

function StatCard({ label, value, format = 'number' }: { label: string; value: number | null; format?: 'number' | 'currency' | 'percent' | 'count' }) {
    const formatted = value === null || value === undefined
        ? '—'
        : format === 'currency' ? `$${(value).toFixed(4)}`
        : format === 'percent' ? `${(value * 100).toFixed(2)}%`
        : format === 'count' ? value.toLocaleString()
        : value.toFixed(4);
    const color = format === 'currency' ? (value !== null && value >= 0 ? styles.positive.color : styles.negative.color) : styles.neutral.color;
    return (
        <div style={styles.card}>
            <div style={styles.cardLabel}>{label}</div>
            <div style={{ ...styles.cardValue, color }}>{formatted}</div>
        </div>
    );
}

function TradesTab() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_BASE}/trades?limit=50`)
            .then(r => r.json())
            .then(d => { setTrades(d.trades || []); setLoading(false); })
            .catch(() => { setError('Failed to load trades'); setLoading(false); });
    }, []);

    if (loading) return <div style={styles.loading}>Loading trades…</div>;
    if (error) return <div style={styles.error}>{error}</div>;

    return (
        <div>
            <div style={styles.sectionTitle}>Recent Trades</div>
            <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            {['Date', 'Symbol', 'Exchange', 'Type', 'Qty', 'Price', 'Profit', 'Gas Cost', 'Status'].map(h => (
                                <th key={h} style={styles.th}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {trades.length === 0 ? (
                            <tr><td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: '#718096' }}>No trades recorded yet</td></tr>
                        ) : trades.map(t => (
                            <tr key={t.id}>
                                <td style={styles.td}>{new Date(t.trade_date).toLocaleString()}</td>
                                <td style={styles.td}>{t.symbol}</td>
                                <td style={styles.td}>{t.exchange || '—'}</td>
                                <td style={styles.td}>{t.type}</td>
                                <td style={styles.td}>{t.quantity}</td>
                                <td style={styles.td}>${t.price.toFixed(4)}</td>
                                <td style={{ ...styles.td, color: t.profit >= 0 ? styles.positive.color : styles.negative.color }}>${t.profit.toFixed(4)}</td>
                                <td style={styles.td}>${t.gas_cost.toFixed(6)}</td>
                                <td style={{ ...styles.td, color: t.status === 'completed' ? styles.positive.color : styles.negative.color }}>{t.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatsTab() {
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch(`${API_BASE}/stats?period=${period}`)
            .then(r => r.json())
            .then(d => { setStats(d.stats); setLoading(false); })
            .catch(() => { setError('Failed to load stats'); setLoading(false); });
    }, [period]);

    return (
        <div>
            <div style={styles.sectionTitle}>Profitability Statistics</div>
            <div style={styles.periodSelector}>
                {(['daily', 'weekly', 'monthly'] as const).map(p => (
                    <button key={p} style={period === p ? styles.activePeriodBtn : styles.periodBtn} onClick={() => setPeriod(p)}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
            </div>
            {loading ? <div style={styles.loading}>Loading…</div> : error ? <div style={styles.error}>{error}</div> : (
                <div style={styles.grid}>
                    <StatCard label="Total Trades" value={stats?.total_trades ?? null} format="count" />
                    <StatCard label="Total Profit" value={stats?.total_profit ?? null} format="currency" />
                    <StatCard label="Total Gas Cost" value={stats?.total_gas_cost ?? null} format="currency" />
                    <StatCard label="Avg Profit / Trade" value={stats?.avg_profit ?? null} format="currency" />
                    <StatCard label="Successful Trades" value={stats?.successful_trades ?? null} format="count" />
                    <StatCard label="Failed Trades" value={stats?.failed_trades ?? null} format="count" />
                </div>
            )}
        </div>
    );
}

function PerformanceTab() {
    const [summary, setSummary] = useState<{ daily: Stats; weekly: Stats; monthly: Stats } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_BASE}/performance`)
            .then(r => r.json())
            .then(d => { setSummary(d.summary); setLoading(false); })
            .catch(() => { setError('Failed to load performance data'); setLoading(false); });
    }, []);

    if (loading) return <div style={styles.loading}>Loading performance…</div>;
    if (error) return <div style={styles.error}>{error}</div>;

    return (
        <div>
            <div style={styles.sectionTitle}>Performance Overview</div>
            {(['daily', 'weekly', 'monthly'] as const).map(period => {
                const s = summary?.[period];
                return (
                    <div key={period} style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#a0aec0', marginBottom: '10px', textTransform: 'capitalize' }}>
                            {period}
                        </div>
                        <div style={styles.grid}>
                            <StatCard label="Trades" value={s?.total_trades ?? null} format="count" />
                            <StatCard label="Profit" value={s?.total_profit ?? null} format="currency" />
                            <StatCard label="Gas Cost" value={s?.total_gas_cost ?? null} format="currency" />
                            <StatCard label="Success Rate" value={s && s.total_trades ? (s.successful_trades / s.total_trades) : null} format="percent" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function OpportunitiesTab() {
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [oppStats, setOppStats] = useState<OpportunityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_BASE}/opportunities?limit=50`)
            .then(r => r.json())
            .then(d => { setOpportunities(d.opportunities || []); setOppStats(d.stats); setLoading(false); })
            .catch(() => { setError('Failed to load opportunities'); setLoading(false); });
    }, []);

    if (loading) return <div style={styles.loading}>Loading opportunities…</div>;
    if (error) return <div style={styles.error}>{error}</div>;

    const successRate = oppStats && oppStats.total > 0 ? oppStats.executed / oppStats.total : null;

    return (
        <div>
            <div style={styles.sectionTitle}>Opportunity Analysis</div>
            <div style={{ ...styles.grid, marginBottom: '24px' }}>
                <StatCard label="Total Detected" value={oppStats?.total ?? null} format="count" />
                <StatCard label="Executed" value={oppStats?.executed ?? null} format="count" />
                <StatCard label="Skipped" value={oppStats?.skipped ?? null} format="count" />
                <StatCard label="Failed" value={oppStats?.failed ?? null} format="count" />
                <StatCard label="Success Rate" value={successRate} format="percent" />
                <StatCard label="Avg Expected Profit" value={oppStats?.avg_expected_profit ?? null} format="currency" />
                <StatCard label="Avg Actual Profit" value={oppStats?.avg_actual_profit ?? null} format="currency" />
            </div>
            <div style={styles.tableWrapper}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            {['Detected At', 'Symbol', 'Type', 'From', 'To', 'Expected Profit', 'Actual Profit', 'Gas Cost', 'Status'].map(h => (
                                <th key={h} style={styles.th}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {opportunities.length === 0 ? (
                            <tr><td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: '#718096' }}>No opportunities recorded yet</td></tr>
                        ) : opportunities.map(o => (
                            <tr key={o.id}>
                                <td style={styles.td}>{new Date(o.detected_at).toLocaleString()}</td>
                                <td style={styles.td}>{o.symbol}</td>
                                <td style={styles.td}>{o.type}</td>
                                <td style={styles.td}>{o.exchange_from || '—'}</td>
                                <td style={styles.td}>{o.exchange_to || '—'}</td>
                                <td style={{ ...styles.td, color: styles.positive.color }}>${o.expected_profit.toFixed(4)}</td>
                                <td style={{ ...styles.td, color: o.actual_profit >= 0 ? styles.positive.color : styles.negative.color }}>${o.actual_profit.toFixed(4)}</td>
                                <td style={styles.td}>${o.gas_cost.toFixed(6)}</td>
                                <td style={{ ...styles.td, color: o.status === 'executed' ? styles.positive.color : o.status === 'failed' ? styles.negative.color : styles.neutral.color }}>{o.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

type TabKey = 'trades' | 'stats' | 'performance' | 'opportunities';

const TABS: { key: TabKey; label: string }[] = [
    { key: 'trades', label: 'Trade History' },
    { key: 'stats', label: 'Statistics' },
    { key: 'performance', label: 'Performance' },
    { key: 'opportunities', label: 'Opportunities' },
];

export default function App() {
    const [activeTab, setActiveTab] = useState<TabKey>('trades');

    return (
        <div style={styles.app}>
            <div style={styles.header}>
                <div style={styles.title}>Arbitrage Bot Dashboard</div>
                <div style={styles.subtitle}>Real-time monitoring of bot performance, trades, and profitability</div>
            </div>
            <div style={styles.tabs}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        style={activeTab === tab.key ? styles.activeTab : styles.tab}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {activeTab === 'trades' && <TradesTab />}
            {activeTab === 'stats' && <StatsTab />}
            {activeTab === 'performance' && <PerformanceTab />}
            {activeTab === 'opportunities' && <OpportunitiesTab />}
        </div>
    );
}
