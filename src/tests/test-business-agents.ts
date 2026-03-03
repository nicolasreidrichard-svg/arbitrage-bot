// test-business-agents.ts
// Tests for AppointmentScheduler and ShopMonitor agents

import AppointmentScheduler, { Appointment } from '../agents/appointment-scheduler';
import ShopMonitor, { OrderSummary } from '../agents/shop-monitor';

// Simple assertion helper (same pattern as test-earnings-fetcher.ts)
function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(`FAIL: ${message}`);
    console.log(`  PASS: ${message}`);
}

// ── AppointmentScheduler tests ────────────────────────────────────────────────

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
    return {
        id: 'appt-1',
        title: 'Doctor visit',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h from now
        durationMinutes: 30,
        ...overrides,
    };
}

function testAddAndListAppointments(): void {
    console.log('\n[AppointmentScheduler] add and list appointments');
    const scheduler = new AppointmentScheduler();

    assert(scheduler.getUpcomingAppointments().length === 0, 'empty by default');

    scheduler.addAppointment(makeAppointment());
    assert(scheduler.getUpcomingAppointments().length === 1, 'one appointment after add');

    scheduler.dispose();
}

function testRemoveAppointment(): void {
    console.log('\n[AppointmentScheduler] remove appointment');
    const scheduler = new AppointmentScheduler();

    scheduler.addAppointment(makeAppointment({ id: 'appt-remove' }));
    assert(scheduler.removeAppointment('appt-remove'), 'remove returns true for existing id');
    assert(!scheduler.removeAppointment('appt-remove'), 'remove returns false for missing id');
    assert(scheduler.getUpcomingAppointments().length === 0, 'no upcoming after removal');

    scheduler.dispose();
}

function testUpcomingOnlyReturnsFuture(): void {
    console.log('\n[AppointmentScheduler] getUpcomingAppointments filters past appointments');
    const scheduler = new AppointmentScheduler();

    const past = makeAppointment({
        id: 'past',
        startTime: new Date(Date.now() - 60 * 1000).toISOString(), // 1 min ago
    });
    const future = makeAppointment({ id: 'future' });

    // Bypass scheduleReminder side-effects by accessing the internal list directly
    // @ts-expect-error – accessing private for testing
    scheduler.appointments.push(past, future);

    const upcoming = scheduler.getUpcomingAppointments();
    assert(upcoming.length === 1, 'only future appointment returned');
    assert(upcoming[0].id === 'future', 'future appointment has correct id');

    scheduler.dispose();
}

function testConflictDetection(): void {
    console.log('\n[AppointmentScheduler] conflict detection with business hours');
    const scheduler = new AppointmentScheduler();

    // Create a date that is definitely outside 09:00-17:00 (e.g. 07:30)
    const outsideHours = new Date();
    outsideHours.setHours(7, 30, 0, 0);
    const conflict = makeAppointment({ id: 'conflict', startTime: outsideHours.toISOString() });

    // And one that is inside business hours (10:00)
    const insideHours = new Date();
    insideHours.setHours(10, 0, 0, 0);
    const noConflict = makeAppointment({ id: 'noConflict', startTime: insideHours.toISOString() });

    assert(scheduler.conflictsWithBusinessHours(conflict), 'outside hours → conflict');
    assert(!scheduler.conflictsWithBusinessHours(noConflict), 'inside hours → no conflict');

    scheduler.dispose();
}

function testUpcomingOrdering(): void {
    console.log('\n[AppointmentScheduler] getUpcomingAppointments returns chronological order');
    const scheduler = new AppointmentScheduler();

    const first = makeAppointment({
        id: 'first',
        startTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    });
    const second = makeAppointment({
        id: 'second',
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    });

    // @ts-expect-error – accessing private for testing
    scheduler.appointments.push(second, first); // intentionally reversed

    const upcoming = scheduler.getUpcomingAppointments();
    assert(upcoming[0].id === 'first', 'earliest appointment is first');
    assert(upcoming[1].id === 'second', 'later appointment is second');

    scheduler.dispose();
}

// ── ShopMonitor tests ─────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderSummary> = {}): OrderSummary {
    return {
        orderId: '1001',
        customerName: 'Jane Smith',
        items: 2,
        totalAmount: 89.99,
        placedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
        status: 'pending',
        priority: 'normal',
        ...overrides,
    };
}

function testNoBacklog(): void {
    console.log('\n[ShopMonitor] no backlog when orders below threshold');
    const monitor = new ShopMonitor();

    const report = monitor.buildBacklogReport([makeOrder()]);
    // Default threshold is 10; 1 order should not trigger backlog
    assert(!report.isBacklogged, 'single pending order is not a backlog');
    assert(report.pendingOrders === 1, 'pending order count is 1');
}

function testBacklogDetection(): void {
    console.log('\n[ShopMonitor] backlog detected when orders ≥ threshold');
    const monitor = new ShopMonitor();

    // Build 10 pending orders
    const orders = Array.from({ length: 10 }, (_, i) =>
        makeOrder({ orderId: String(1000 + i) })
    );
    const report = monitor.buildBacklogReport(orders);

    assert(report.isBacklogged, '10 orders triggers backlog');
    assert(report.pendingOrders === 10, 'pending order count is 10');
}

function testPriorityOrdersAreOldest(): void {
    console.log('\n[ShopMonitor] priority orders are the oldest pending ones');
    const monitor = new ShopMonitor();

    const now = Date.now();
    const orders = Array.from({ length: 8 }, (_, i) =>
        makeOrder({
            orderId: String(1000 + i),
            placedAt: new Date(now - i * 60 * 60 * 1000).toISOString(), // i hours ago
        })
    );
    const report = monitor.buildBacklogReport(orders);

    // Priority orders should be capped at 5
    assert(report.priorityOrders.length <= 5, 'at most 5 priority orders');
    // All returned priority orders should have priority = 'high'
    assert(
        report.priorityOrders.every((o) => o.priority === 'high'),
        'priority orders are marked high'
    );
    // The first priority order should be the oldest (highest index since we went oldest-first)
    const oldestId = String(1000 + 7); // 7 hours ago = oldest
    assert(report.priorityOrders[0].orderId === oldestId, 'oldest order is first priority');
}

function testCompletedOrdersExcluded(): void {
    console.log('\n[ShopMonitor] completed/shipped orders excluded from pending count');
    const monitor = new ShopMonitor();

    const orders = [
        makeOrder({ orderId: '1', status: 'pending' }),
        makeOrder({ orderId: '2', status: 'shipped' }),
        makeOrder({ orderId: '3', status: 'completed' }),
        makeOrder({ orderId: '4', status: 'processing' }),
    ];
    const report = monitor.buildBacklogReport(orders);

    // Only 'pending' and 'processing' should count
    assert(report.pendingOrders === 2, 'shipped/completed orders not counted');
}

// ── Run All Tests ─────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
    console.log('=== test-business-agents.ts ===');
    let passed = 0;
    let failed = 0;

    const tests = [
        testAddAndListAppointments,
        testRemoveAppointment,
        testUpcomingOnlyReturnsFuture,
        testConflictDetection,
        testUpcomingOrdering,
        testNoBacklog,
        testBacklogDetection,
        testPriorityOrdersAreOldest,
        testCompletedOrdersExcluded,
    ];

    for (const test of tests) {
        try {
            test();
            passed++;
        } catch (error) {
            console.error(`  ERROR in ${test.name}: ${error}`);
            failed++;
        }
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
    console.error('Test runner error:', err);
    process.exit(1);
});
