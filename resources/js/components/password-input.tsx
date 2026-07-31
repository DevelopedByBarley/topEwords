import { Eye, EyeOff } from 'lucide-react';
import type { ComponentProps, KeyboardEvent, Ref } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function PasswordInput({
    className,
    ref,
    onKeyUp,
    onBlur,
    ...props
}: Omit<ComponentProps<'input'>, 'type'> & { ref?: Ref<HTMLInputElement> }) {
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);

    const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
        setCapsLockOn(event.getModifierState('CapsLock'));
        onKeyUp?.(event);
    };

    return (
        <div className="grid gap-1.5">
            <div className="relative">
                <Input
                    type={showPassword ? 'text' : 'password'}
                    className={cn('pr-11', className)}
                    ref={ref}
                    onKeyUp={handleKeyUp}
                    onBlur={(event) => {
                        setCapsLockOn(false);
                        onBlur?.(event);
                    }}
                    {...props}
                />
                {/*
                 * A gomb szándékosan a natív tab-sorrendben marad: a jelszó
                 * visszaolvasása pont annak a felhasználónak segít a legtöbbet,
                 * aki nem egérrel dolgozik. Korábban ki volt véve belőle.
                 */}
                <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={
                        showPassword
                            ? 'Jelszó elrejtése'
                            : 'Jelszó megjelenítése'
                    }
                    aria-pressed={showPassword}
                    title={
                        showPassword
                            ? 'Jelszó elrejtése'
                            : 'Jelszó megjelenítése'
                    }
                >
                    {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                        <Eye className="size-4" aria-hidden="true" />
                    )}
                </button>
            </div>

            {/*
             * Bekapcsolt Caps Lock mellett a takart jelszó elgépelése láthatatlan,
             * és a felhasználó a fiókját hiszi elveszettnek — ezért jelezzük.
             */}
            {capsLockOn && (
                <p
                    role="status"
                    className="text-xs font-medium text-amber-600 dark:text-amber-400"
                >
                    A Caps Lock be van kapcsolva.
                </p>
            )}
        </div>
    );
}
