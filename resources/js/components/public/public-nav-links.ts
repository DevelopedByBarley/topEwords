import { guide, handbook, home, pricing } from '@/routes';

/**
 * A publikus oldalak egységes navigációja. Egy helyen tartjuk, mert a fejléc
 * (asztali + mobil menü) és a lábléc ugyanezt a listát rendezi ki — korábban
 * minden publikus oldal saját, egymástól eltérő linksort vitt.
 *
 * A `#`-es célok a főoldal szekció-ID-jei: azonos oldalon natív ugrás, más
 * oldalról teljes betöltés a főoldalra. Ezért `<a>`-val kell renderelni őket,
 * Inertia `<Link>`-kel nem.
 */
export type PublicNavLink = {
    label: string;
    href: string;
    /** Igaz, ha a link a főoldal egy szekciójára mutat (`/#id`). */
    isAnchor?: boolean;
};

export const PUBLIC_NAV_LINKS: PublicNavLink[] = [
    { label: 'Funkciók', href: `${home.url()}#funkciok`, isAnchor: true },
    { label: 'Flashcard', href: `${home.url()}#flashcard`, isAnchor: true },
    { label: 'Bővítmény', href: `${home.url()}#bovitmeny`, isAnchor: true },
    { label: 'Árazás', href: pricing.url() },
    { label: 'Tananyag', href: guide.url() },
];

/**
 * A láblécben a fejléc-linkeken túl a hosszabb, ritkábban keresett oldalak is
 * megjelennek — a kézikönyv és a szólista-szekció eddig sehonnan sem volt
 * elérhető a publikus felületről.
 */
export const PUBLIC_FOOTER_LINKS: PublicNavLink[] = [
    ...PUBLIC_NAV_LINKS,
    { label: 'Szólista', href: `${home.url()}#szolista`, isAnchor: true },
    { label: 'Kézikönyv', href: handbook.url() },
];
