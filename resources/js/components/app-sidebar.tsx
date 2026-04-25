import { Link, usePage } from '@inertiajs/react';
import { BookOpen, FolderOpen, Globe, LayoutGrid, Languages, Layers, Medal, NotebookPen, PenLine, Puzzle, ScanText, Shuffle, Sparkles, Swords } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { useExtensionInstalled } from '@/hooks/use-extension-installed';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { dashboard } from '@/routes';
import { index as achievementsIndex } from '@/routes/achievements';
import { index as irregularVerbsIndex } from '@/routes/irregular-verbs';
import { cloze as wordsCloze, practice as wordsPractice } from '@/routes/words';
import { show as textAnalysisShow } from '@/routes/text-analysis';
import { index as flashcardsIndex } from '@/routes/flashcards';
import { index as wordsIndex, quiz as wordsQuiz } from '@/routes/words';
import type { NavItem } from '@/types';

const tanulasTailItems: NavItem[] = [
    { title: 'Flashcards', href: flashcardsIndex(), icon: Layers, tourId: 'tour-flashcards', isAi: true },
    { title: 'Szövegelemzés', href: textAnalysisShow(), icon: ScanText, tourId: 'tour-text-analysis', isAi: true },
];

const navGroups: { label?: string; items: NavItem[] }[] = [
    {
        items: [
            {
                title: 'Dashboard',
                href: dashboard(),
                icon: LayoutGrid,
                tourId: 'tour-dashboard',
            },
        ],
    },
    {
        label: 'Tanulás',
        items: [
            {
                title: 'Angol szavak',
                href: wordsIndex.url(),
                icon: Languages,
                tourId: 'tour-words',
                isAi: true,
            },
            {
                title: 'Flashcards',
                href: flashcardsIndex(),
                icon: Layers,
                tourId: 'tour-flashcards',
                isAi: true,
            },
            {
                title: 'Szövegelemzés',
                href: textAnalysisShow(),
                icon: ScanText,
                tourId: 'tour-text-analysis',
                isAi: true,
            },
        ],
    },
    {
        label: 'Gyakorlás',
        items: [
            {
                title: 'Kvíz',
                href: wordsQuiz(),
                icon: Swords,
                tourId: 'tour-quiz',
            },
            {
                title: 'Mondatkiegészítés',
                href: wordsCloze(),
                icon: PenLine,
                tourId: 'tour-cloze',
            },
            {
                title: 'Rendhagyó igék',
                href: irregularVerbsIndex.url(),
                icon: Shuffle,
                tourId: 'tour-irregular-verbs',
            },
        ],
    },
    {
        label: 'Haladás',
        items: [
            {
                title: 'Teljesítmények',
                href: achievementsIndex(),
                icon: Medal,
                tourId: 'tour-achievements',
            },
            {
                title: 'Kézikönyv',
                href: '/guide',
                icon: BookOpen,
            },
        ],
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'codebarley.hu',
        href: 'https://codebarley.hu',
        icon: Globe,
    },
];

export function AppSidebar() {
    const { url, props } = usePage() as any;
    const { isCurrentUrl } = useCurrentUrl();
    const isAdmin: boolean = (props as any)?.auth?.isAdmin ?? false;
    const extensionInstalled = useExtensionInstalled();
    const isOnWordsPage = url.startsWith(wordsIndex.url()) && !url.startsWith(wordsQuiz.url()) && !url.startsWith(wordsCloze.url());

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                        <a
                            href="https://codebarley.hu"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 truncate text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden"
                        >
                            by CodeBarley
                        </a>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={navGroups[0].items} />

                <SidebarGroup className="px-2 py-0">
                    <SidebarGroupLabel>Tanulás</SidebarGroupLabel>
                    <SidebarMenu>
                        <SidebarMenuItem id="tour-words">
                            <SidebarMenuButton
                                asChild
                                isActive={isCurrentUrl(wordsIndex.url())}
                                tooltip={{ children: 'Angol szavak' }}
                            >
                                <Link href={wordsIndex.url()} prefetch className="flex items-center justify-between w-full">
                                    <span className="flex items-center gap-2 min-w-0">
                                        <Languages className="shrink-0" />
                                        <span className="truncate">Angol szavak</span>
                                    </span>
                                    <span className="group-data-[collapsible=icon]:hidden ml-auto flex items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-900/40 dark:text-violet-400 shrink-0">
                                        <Sparkles className="size-3" />
                                        AI
                                    </span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        {isOnWordsPage && (
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip={{ children: 'Mappák' }}
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-folder-sheet'))}
                                    className="pl-8 text-muted-foreground"
                                >
                                    <FolderOpen />
                                    <span>Mappák</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                        {tanulasTailItems.map((item) => (
                            <SidebarMenuItem key={item.title} id={item.tourId}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isCurrentUrl(item.href)}
                                    tooltip={{ children: item.title }}
                                >
                                    <Link href={item.href} prefetch className="flex items-center justify-between w-full">
                                        <span className="flex items-center gap-2 min-w-0">
                                            {item.icon && <item.icon className="shrink-0" />}
                                            <span className="truncate">{item.title}</span>
                                        </span>
                                        {item.isAi && (
                                            <span className="group-data-[collapsible=icon]:hidden ml-auto flex items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-900/40 dark:text-violet-400 shrink-0">
                                                <Sparkles className="size-3" />
                                                AI
                                            </span>
                                        )}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>

                <NavMain label={navGroups[2].label} items={[
                    ...navGroups[2].items,
                    ...(isAdmin ? [{ title: 'Szabad írás', href: wordsPractice(), icon: NotebookPen, isAi: true }] : []),
                ]} />
                <NavMain label={navGroups[3].label} items={navGroups[3].items} />

                {extensionInstalled === false && (
                    <SidebarGroup className="hidden md:block px-2 py-0 pb-2">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    tooltip={{ children: 'Bővítmény telepítése' }}
                                    className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                                >
                                    <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer">
                                        <Puzzle />
                                        <span>Bővítmény telepítése</span>
                                        <span className="ml-auto size-2 rounded-full bg-violet-500 group-data-[collapsible=icon]:hidden" />
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
