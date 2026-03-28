import { Link, usePage } from '@inertiajs/react';
import { FolderOpen, Globe, LayoutGrid, Languages } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
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
import { dashboard } from '@/routes';
import { index as wordsIndex } from '@/routes/words';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Angol szavak',
        href: wordsIndex.url(),
        icon: Languages,
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
    const { url } = usePage();
    const isOnWordsPage = url.startsWith(wordsIndex.url());

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
                <NavMain items={mainNavItems} />
                {isOnWordsPage && <SidebarGroup className="px-2 py-0">
                    <SidebarGroupLabel>Szótár</SidebarGroupLabel>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                tooltip={{ children: 'Mappák' }}
                                onClick={() => window.dispatchEvent(new CustomEvent('open-folder-sheet'))}
                            >
                                <FolderOpen />
                                <span>Mappák</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
