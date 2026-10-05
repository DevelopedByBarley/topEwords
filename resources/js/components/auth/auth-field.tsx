import type { ComponentProps, ReactNode } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = Omit<ComponentProps<'input'>, 'id'> & {
    id: string;
    label: ReactNode;
    labelAction?: ReactNode;
    hint?: ReactNode;
    error?: string;
    password?: boolean;
};

export default function AuthField({
    id,
    label,
    labelAction,
    hint,
    error,
    password = false,
    className,
    type,
    ...props
}: Props) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy =
        [hintId, errorId].filter(Boolean).join(' ') || undefined;

    const fieldProps = {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        className: cn(
            'h-11 rounded-xl focus-visible:border-indigo-400 focus-visible:ring-indigo-400/50',
            className,
        ),
        ...props,
    };

    return (
        <div className="grid gap-2">
            <div className="flex items-center gap-3">
                <Label htmlFor={id}>{label}</Label>
                {labelAction && <div className="ml-auto">{labelAction}</div>}
            </div>

            {password ? (
                <PasswordInput {...fieldProps} />
            ) : (
                <Input type={type} {...fieldProps} />
            )}

            {hint && (
                <div id={hintId} className="text-xs text-muted-foreground">
                    {hint}
                </div>
            )}

            <InputError id={errorId} message={error} />
        </div>
    );
}
