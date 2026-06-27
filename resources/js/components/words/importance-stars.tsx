interface ImportanceStarsProps {
    value: number | null;
    onChange: (value: number | null) => void;
}

export default function ImportanceStars({ value, onChange }: ImportanceStarsProps) {
    return (
        <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fontosság</p>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(value === n ? null : n)}
                        title={`${n} csillag`}
                        className={`flex-1 rounded-lg py-2 text-lg transition-all ${
                            (value ?? 0) >= n ? 'text-amber-400 hover:text-amber-500' : 'text-muted-foreground/30 hover:text-amber-300'
                        }`}
                    >
                        ★
                    </button>
                ))}
            </div>
        </div>
    );
}
