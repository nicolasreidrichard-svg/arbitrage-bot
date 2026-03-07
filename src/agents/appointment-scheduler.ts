// appointment-scheduler.ts
// Agent that manages business appointments for duenorthlingerie.com.
// It stores upcoming appointments, fires reminder alerts before each one,
// and detects scheduling conflicts with defined business hours so the owner
// can be notified in advance and arrange cover.

import logger from '../utils/logger';
import businessConfig from '../config/business-config';

export interface Appointment {
    id: string;
    title: string;
    /** ISO-8601 datetime string */
    startTime: string;
    /** Duration in minutes */
    durationMinutes: number;
    /** Optional notes (e.g. "doctor – bring insurance card") */
    notes?: string;
}

export interface AppointmentAlert {
    appointment: Appointment;
    minutesUntilStart: number;
    message: string;
}

/**
 * Parse a "HH:MM-HH:MM" business-hours string into start/end minute-of-day values.
 */
function parseBusinessHours(range: string): { startMinutes: number; endMinutes: number } | null {
    const match = range.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, sh, sm, eh, em] = match.map(Number);
    return { startMinutes: sh * 60 + sm, endMinutes: eh * 60 + em };
}

class AppointmentScheduler {
    private appointments: Appointment[] = [];
    private reminderTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private readonly reminderLeadTime: number;
    private readonly businessHours: string;

    constructor() {
        this.reminderLeadTime = businessConfig.appointments.reminderLeadTimeMinutes;
        this.businessHours = businessConfig.appointments.businessHours;
    }

    /** Add a new appointment and schedule its reminder. */
    addAppointment(appointment: Appointment): void {
        this.appointments.push(appointment);
        logger.log(`[AppointmentScheduler] Added appointment "${appointment.title}" at ${appointment.startTime}`);
        this.scheduleReminder(appointment);
    }

    /** Remove an appointment and cancel its pending reminder. */
    removeAppointment(id: string): boolean {
        const index = this.appointments.findIndex((a) => a.id === id);
        if (index === -1) return false;

        this.appointments.splice(index, 1);
        const timer = this.reminderTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.reminderTimers.delete(id);
        }
        logger.log(`[AppointmentScheduler] Removed appointment ${id}`);
        return true;
    }

    /** Return all upcoming appointments (start time is in the future). */
    getUpcomingAppointments(): Appointment[] {
        const now = Date.now();
        return this.appointments
            .filter((a) => new Date(a.startTime).getTime() > now)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }

    /**
     * Check whether an appointment falls outside configured business hours.
     * Returns true when the start time is OUTSIDE business hours (a conflict).
     */
    conflictsWithBusinessHours(appointment: Appointment): boolean {
        const parsed = parseBusinessHours(this.businessHours);
        if (!parsed) return false;

        const startDate = new Date(appointment.startTime);
        const minuteOfDay = startDate.getHours() * 60 + startDate.getMinutes();
        return minuteOfDay < parsed.startMinutes || minuteOfDay >= parsed.endMinutes;
    }

    /** List appointments that conflict with business hours. */
    getConflicts(): Appointment[] {
        return this.appointments.filter((a) => this.conflictsWithBusinessHours(a));
    }

    private scheduleReminder(appointment: Appointment): void {
        const startMs = new Date(appointment.startTime).getTime();
        const reminderMs = startMs - this.reminderLeadTime * 60 * 1000;
        const delayMs = reminderMs - Date.now();

        if (delayMs <= 0) {
            // Appointment is already too close or in the past – log but don't schedule.
            logger.warn(
                `[AppointmentScheduler] Reminder for "${appointment.title}" skipped – less than ${this.reminderLeadTime} min away`
            );
            return;
        }

        const timer = setTimeout(() => {
            this.fireReminder(appointment);
        }, delayMs);

        this.reminderTimers.set(appointment.id, timer);
    }

    private fireReminder(appointment: Appointment): void {
        const alert: AppointmentAlert = {
            appointment,
            minutesUntilStart: this.reminderLeadTime,
            message: `Reminder: "${appointment.title}" starts in ${this.reminderLeadTime} minutes (${appointment.startTime}).${appointment.notes ? ' Notes: ' + appointment.notes : ''}`,
        };

        logger.log(`[AppointmentScheduler] REMINDER – ${alert.message}`);
        this.reminderTimers.delete(appointment.id);
    }

    /** Cancel all pending reminders (call on shutdown). */
    dispose(): void {
        for (const timer of this.reminderTimers.values()) {
            clearTimeout(timer);
        }
        this.reminderTimers.clear();
        logger.log('[AppointmentScheduler] Disposed – all reminders cancelled');
    }
}

export default AppointmentScheduler;
