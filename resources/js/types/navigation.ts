import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

export type BreadcrumbItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
};

export type NavItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
    tourId?: string;
    isAi?: boolean;
    /** Külső cél: sima `<a target="_blank">`, nem Inertia-látogatás. */
    isExternal?: boolean;
};
