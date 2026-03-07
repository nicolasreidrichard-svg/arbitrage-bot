// business-config.ts
// Configuration for business-facing agents: domain management, appointment scheduling,
// and shop order monitoring for duenorthlingerie.com

export interface DomainConfig {
    /** Primary business domain (e.g. duenorthlingerie.com) */
    domain: string;
    /** GoDaddy API key – obtain at https://developer.godaddy.com/keys */
    godaddyApiKey: string;
    /** GoDaddy API secret */
    godaddyApiSecret: string;
    /** GoDaddy OTE (test) environment – set to false in production */
    godaddySandbox: boolean;
}

export interface AppointmentConfig {
    /** Alert email for appointment reminders */
    alertEmail: string;
    /** How many minutes before an appointment to send a reminder */
    reminderLeadTimeMinutes: number;
    /** Quiet hours during which bot activity is reduced (24-hour, e.g. "09:00-17:00") */
    businessHours: string;
    /** Whether the appointment scheduler agent is enabled */
    enabled: boolean;
}

export interface ShopConfig {
    /** Public URL of the shop (used for health-checks and link generation) */
    shopUrl: string;
    /** Number of pending orders considered a backlog (triggers an alert) */
    backlogThreshold: number;
    /** How often (ms) to poll the shop for new orders */
    pollIntervalMs: number;
    /** HTTP request timeout (ms) for shop API calls */
    apiTimeoutMs: number;
    /** Whether the shop monitor agent is enabled */
    enabled: boolean;
}

export interface BusinessConfig {
    domain: DomainConfig;
    appointments: AppointmentConfig;
    shop: ShopConfig;
}

const businessConfig: BusinessConfig = {
    domain: {
        domain: process.env.BUSINESS_DOMAIN || 'duenorthlingerie.com',
        godaddyApiKey: process.env.GODADDY_API_KEY || '',
        godaddyApiSecret: process.env.GODADDY_API_SECRET || '',
        godaddySandbox: process.env.GODADDY_SANDBOX === 'true',
    },
    appointments: {
        alertEmail: process.env.APPOINTMENT_ALERT_EMAIL || process.env.ALERT_EMAIL || '',
        reminderLeadTimeMinutes: parseInt(
            process.env.APPOINTMENT_REMINDER_MINUTES || '30',
            10
        ),
        businessHours: process.env.BUSINESS_HOURS || '09:00-17:00',
        enabled: process.env.APPOINTMENT_AGENT_ENABLED !== 'false',
    },
    shop: {
        shopUrl: process.env.SHOP_URL || `https://${process.env.BUSINESS_DOMAIN || 'duenorthlingerie.com'}`,
        backlogThreshold: parseInt(process.env.SHOP_BACKLOG_THRESHOLD || '10', 10),
        pollIntervalMs: parseInt(process.env.SHOP_POLL_INTERVAL_MS || '60000', 10),
        apiTimeoutMs: parseInt(process.env.SHOP_API_TIMEOUT_MS || '10000', 10),
        enabled: process.env.SHOP_MONITOR_ENABLED !== 'false',
    },
};

export default businessConfig;
