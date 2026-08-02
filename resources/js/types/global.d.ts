import type { Auth } from '@/types/auth';

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            billingEnabled: boolean;
            extensionStoreUrl: string | null;
            aiBudgetWarning: {
                level: 'low' | 'exhausted';
                remaining_percent: number;
                reset_at: string;
            } | null;
            flash: {
                streakTriggered: number | null;
                success: string | null;
                error: string | null;
                info: string | null;
                achievements: Array<{
                    key: string;
                    title: string;
                    description: string;
                    icon: string;
                    group: string;
                }>;
            };
            [key: string]: unknown;
        };
    }
}
