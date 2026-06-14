export type * from './auth';
export type * from './navigation';
export type * from './ui';

export interface PaginationData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    first_page_url: string;
    last_page_url: string;
    path: string;
    links: Array<{ url: string | null; label: string; active: boolean }>;
}
