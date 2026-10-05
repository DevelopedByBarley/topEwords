import { useEffect } from 'react';

export default function FocusFirstError({
    errors,
}: {
    errors: Record<string, string>;
}) {
    const firstField = Object.keys(errors)[0];

    useEffect(() => {
        if (!firstField) {
            return;
        }

        const field =
            document.querySelector<HTMLElement>(
                `[name="${CSS.escape(firstField)}"]:not([aria-hidden="true"])`,
            ) ?? document.getElementById(firstField);

        field?.focus();
    }, [firstField]);

    return null;
}
