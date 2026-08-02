export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    billing_name: string | null;
    billing_tax_number: string | null;
    billing_country: string;
    billing_zip: string | null;
    billing_city: string | null;
    billing_address: string | null;
    billing_type: 'individual' | 'company';
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

/**
 * A csomag-állapot, ahogy a `HandleInertiaRequests` minden oldalra kiküldi.
 * `null` vendégként.
 */
export type Subscription = {
    plan: 'free' | 'premium';
    hasActiveAccess: boolean;
    isSubscribed: boolean;
    isPremium: boolean;
    hasAiAccess: boolean;
    isOnTrial: boolean;
};

export type Auth = {
    user: User;
    isAdmin: boolean;
    subscription: Subscription | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
