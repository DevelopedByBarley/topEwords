import { cn } from '@/lib/utils';

/**
 * A `Password::defaults()` élesben érvényes szabályai (AppServiceProvider).
 * Csak tájékoztat — a beküldést nem tiltja, az érdemi ellenőrzés a szerveré.
 */
const rules: { label: string; isMet: (value: string) => boolean }[] = [
    { label: 'legalább 12 karakter', isMet: (v) => v.length >= 12 },
    {
        label: 'kis- és nagybetű',
        isMet: (v) => /\p{Ll}/u.test(v) && /\p{Lu}/u.test(v),
    },
    { label: 'szám', isMet: (v) => /\d/.test(v) },
    { label: 'speciális karakter', isMet: (v) => /[^\p{L}\p{N}]/u.test(v) },
];

/** „a, b és c” — felsorolás magyar kötőszóval. */
function joinLabels(labels: string[]): string {
    if (labels.length < 2) {
        return labels.join('');
    }

    return `${labels.slice(0, -1).join(', ')} és ${labels[labels.length - 1]}`;
}

/**
 * Tömör jelszó-visszajelzés: egy négyszegmensű sáv és egyetlen szöveges sor.
 *
 * Pipás felsorolás volt itt, de keskeny hasábban rendezetlenül tördelődött —
 * ez a forma egy-két sorban elfér, és csak a még hiányzó feltételeket mondja ki.
 */
export default function PasswordRequirements({
    id,
    value,
}: {
    id?: string;
    value: string;
}) {
    const missing = rules.filter((rule) => !rule.isMet(value));
    const metCount = rules.length - missing.length;
    const isComplete = missing.length === 0;

    const message = isComplete
        ? 'A jelszó megfelel a követelményeknek.'
        : value === ''
          ? `Elvárt: ${joinLabels(rules.map((rule) => rule.label))}.`
          : `Még hiányzik: ${joinLabels(missing.map((rule) => rule.label))}.`;

    return (
        <div id={id} className="grid gap-1.5 pt-0.5">
            <div className="flex gap-1" aria-hidden="true">
                {rules.map((rule, index) => (
                    <span
                        key={rule.label}
                        className={cn(
                            'h-1 flex-1 rounded-full transition-colors',
                            index >= metCount
                                ? 'bg-border'
                                : isComplete
                                  ? 'bg-green-500'
                                  : 'bg-amber-400',
                        )}
                    />
                ))}
            </div>

            <p
                className={cn(
                    isComplete && 'text-green-600 dark:text-green-400',
                )}
            >
                {message}
            </p>
        </div>
    );
}
