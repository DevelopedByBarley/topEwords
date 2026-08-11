export interface Stats {
    totalUsers: number;
    verifiedUsers: number;
    usersThisWeek: number;
    usersThisMonth: number;
    activeToday: number;
    totalWordStatuses: number;
    known: number;
    learning: number;
    saved: number;
    pronunciation: number;
}

export interface AdminUser {
    name: string;
    email: string;
    streak: number;
    last_activity_date: string | null;
    created_at?: string;
    email_verified_at?: string | null;
    known_words_count?: number;
}

export interface RegistrationDay {
    date: string;
    count: number;
}

export interface AccessUser {
    id: number;
    name: string;
    email: string;
    plan: 'free' | 'premium';
    plan_override: 'premium' | null;
    subscribed: boolean;
    subscription_plan: 'premium' | null;
    trial_ends_at: string | null;
}

export interface Invite {
    id: number;
    code: string;
    label: string | null;
    uses: number;
    max_uses: number;
    expires_at: string | null;
    usable: boolean;
    url: string;
    used_by: string[];
}

export interface Report {
    id: number;
    category: 'bug' | 'missing_feature' | 'word_data' | 'other';
    description: string;
    status: 'open' | 'resolved';
    created_at: string;
    user: { id: number; name: string; email: string } | null;
    word: { id: number; word: string } | null;
}

export interface AccessTabProps {
    accessUsers: AccessUser[];
}

export interface InvitesTabProps {
    invites: Invite[];
    inviteOnly: boolean;
}

export interface ReportsTabProps {
    reports: Report[];
}

export interface OverviewTabProps {
    stats: Stats;
    topStreaks: AdminUser[];
    recentUsers: AdminUser[];
    mostActive: AdminUser[];
    registrationsByDay: RegistrationDay[];
}

export interface AdminIndexPageProps {
    stats: Stats;
    topStreaks: AdminUser[];
    recentUsers: AdminUser[];
    mostActive: AdminUser[];
    registrationsByDay: RegistrationDay[];
    accessUsers: AccessUser[];
    invites: Invite[];
    inviteOnly: boolean;
    reports: Report[];
}
