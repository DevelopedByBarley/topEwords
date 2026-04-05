import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, Code, Strikethrough, Undo, Redo, Palette, Bookmark, X } from 'lucide-react';
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f87171', '#fb923c', '#fde047', '#86efac',
    '#93c5fd', '#c4b5fd', '#f9a8d4', '#5eead4',
];

type ToolbarButtonProps = {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
};

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            disabled={disabled}
            title={title}
            className={cn(
                'rounded p-1.5 transition-colors',
                active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                disabled && 'pointer-events-none opacity-40',
            )}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <div className="mx-0.5 h-5 w-px bg-border" />;
}

export type RichTextEditorHandle = {
    setContent: (html: string) => void;
    getText: () => string;
};

type RichTextEditorProps = {
    defaultValue?: string;
    placeholder?: string;
    name: string;
    className?: string;
    minHeight?: string;
    speakName?: string;
    defaultSpeakValue?: string;
    onTextChange?: (text: string) => void;
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
    { defaultValue = '', placeholder, name, className, minHeight = '6rem', speakName, defaultSpeakValue = '', onTextChange },
    ref,
) {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [html, setHtml] = useState(defaultValue || '');
    const [speakText, setSpeakText] = useState(defaultSpeakValue || '');
    const colorPickerRef = useRef<HTMLDivElement>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            Color,
            Link.configure({ openOnClick: false }),
            Placeholder.configure({ placeholder: placeholder ?? '' }),
        ],
        content: defaultValue || '',
        onUpdate({ editor: e }) {
            const newHtml = e.getHTML();
            setHtml(newHtml);
            onTextChange?.(e.getText());
        },
        editorProps: {
            attributes: {
                class: 'outline-none min-h-[var(--editor-min-h)] px-3 py-2 prose prose-sm dark:prose-invert max-w-none',
            },
        },
    });

    useImperativeHandle(ref, () => ({
        setContent(newHtml: string) {
            if (!editor) return;
            editor.commands.setContent(newHtml);
            setHtml(newHtml);
        },
        getText() {
            return editor?.getText() ?? '';
        },
    }), [editor]);

    // Sync if defaultValue changes (e.g. editing a different card)
    useEffect(() => {
        if (editor && defaultValue !== undefined) {
            const current = editor.getHTML();
            if (current !== defaultValue) {
                editor.commands.setContent(defaultValue || '');
                setHtml(defaultValue || '');
            }
        }
    }, [defaultValue]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setSpeakText(defaultSpeakValue || '');
    }, [defaultSpeakValue]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLink = () => {
        if (!editor) return;
        const prev = editor.getAttributes('link').href ?? '';
        const url = window.prompt('URL', prev);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().setLink({ href: url }).run();
        }
    };

    const applyColor = (color: string) => {
        editor?.chain().focus().setColor(color).run();
        setShowColorPicker(false);
    };

    const currentColor = editor?.getAttributes('textStyle').color ?? null;

    return (
        <div className={cn('rounded-md border bg-transparent shadow-xs transition-[box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]', className)}>
            <input type="hidden" name={name} value={html} />
            {speakName !== undefined && <input type="hidden" name={speakName} value={speakText} />}

            {editor && (
                <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Félkövér (Ctrl+B)">
                        <Bold className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Dőlt (Ctrl+I)">
                        <Italic className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Aláhúzott (Ctrl+U)">
                        <UnderlineIcon className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Áthúzott">
                        <Strikethrough className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Kód">
                        <Code className="size-3.5" />
                    </ToolbarButton>

                    <Divider />

                    {/* Color picker */}
                    <div className="relative" ref={colorPickerRef}>
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setShowColorPicker((v) => !v); }}
                            title="Szöveg színe"
                            className="rounded p-1.5 transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            <div className="relative">
                                <Palette className="size-3.5" />
                                <div
                                    className="absolute -bottom-0.5 left-0 right-0 h-1 rounded-full"
                                    style={{ backgroundColor: currentColor ?? 'transparent', border: currentColor ? 'none' : '1px solid currentColor' }}
                                />
                            </div>
                        </button>

                        {showColorPicker && (
                            <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border bg-popover p-2 shadow-md">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Szín</span>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                                        className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                                        title="Szín törlése"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-8 gap-1">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); applyColor(color); }}
                                            className="size-5 rounded-sm border border-black/10 transition-transform hover:scale-125"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                                <div className="mt-2 flex items-center gap-1.5">
                                    <input
                                        type="color"
                                        defaultValue={currentColor ?? '#000000'}
                                        onInput={(e) => applyColor((e.target as HTMLInputElement).value)}
                                        className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0"
                                        title="Egyéni szín"
                                    />
                                    <span className="text-xs text-muted-foreground">Egyéni szín</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <Divider />

                    <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Felsorolás">
                        <List className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Számozott lista">
                        <ListOrdered className="size-3.5" />
                    </ToolbarButton>

                    <Divider />

                    <ToolbarButton onClick={handleLink} active={editor.isActive('link')} title="Link beillesztése">
                        <LinkIcon className="size-3.5" />
                    </ToolbarButton>

                    <Divider />

                    <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Visszavonás (Ctrl+Z)">
                        <Undo className="size-3.5" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Újra (Ctrl+Y)">
                        <Redo className="size-3.5" />
                    </ToolbarButton>

                    <Divider />

                    {speakName !== undefined && (
                        <ToolbarButton
                            onClick={() => {
                                const selected = window.getSelection()?.toString().trim();
                                if (selected) {
                                    setSpeakText((prev) => prev ? `${prev} ${selected}` : selected);
                                }
                            }}
                            active={!!speakText}
                            title="Kijelölt szöveg hozzáadása a felolvasandó szöveghez"
                        >
                            <Bookmark className="size-3.5" />
                        </ToolbarButton>
                    )}
                </div>
            )}

            {speakName !== undefined && speakText && (
                <div className="flex items-center gap-1.5 border-b px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30">
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium shrink-0">Kimondandó:</span>
                    <span className="text-xs text-amber-800 dark:text-amber-300 truncate flex-1">{speakText}</span>
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setSpeakText(''); }}
                        className="shrink-0 rounded p-0.5 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900"
                        title="Törlés"
                    >
                        <X className="size-3" />
                    </button>
                </div>
            )}

            <EditorContent
                editor={editor}
                style={{ '--editor-min-h': minHeight } as React.CSSProperties}
            />
        </div>
    );
});

type RichTextContentProps = {
    html: string | null;
    className?: string;
};

export function RichTextContent({ html, className }: RichTextContentProps) {
    if (!html) return null;
    return (
        <div
            className={cn('prose prose-sm dark:prose-invert max-w-none', className)}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
