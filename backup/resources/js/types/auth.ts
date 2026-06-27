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
    creat