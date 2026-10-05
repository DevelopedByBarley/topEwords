import { guide, handbook, home, pricing } from '@/routes';

export type PublicNavLink = {
    label: string;
    href: string;
    isAnchor?: boolean;
};

export const PUBLIC_NAV_LINKS: PublicNavLink[] = [
    { label: 'Funkciók', href: `${home.url()}#funkciok`, isAnchor: true },
    { label: 'Flashcard', href: `${home.url()}#flashcard`, isAnchor: true },
    { label: 'Bővítmény', href: `${home.url()}#bovitmeny`, isAnchor: true },
    { label: 'Árazás', href: pricing.url() },
    { label: 'Tananyag', href: guide.url() },
];

export const PUBLIC_FOOTER_LINKS: PublicNavLink[] = [
    ...PUBLIC_NAV_LINKS,
    { label: 'Szólista', href: `${home.url()}#szolista`, isAnchor: true },
    { label: 'Kézikönyv', href: handbook.url() },
];
