import { Link } from '@inertiajs/react';
import { Sparkles } from 'lucide-react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { toUrl } from '@/lib/utils';
import type { NavItem } from '@/types';

export function NavMain({ label, items = [] }: { label?: string; items: NavItem[] }) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="px-2 py-0">
            {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
            <SidebarMenu>
                {items.map((item) => {
                    const content = (
                        <>
                            <span className="flex items-center gap-2 min-w-0">
                                {item.icon && <item.icon className="shrink-0" />}
                                <span className="truncate">{item.title}</span>
                            </span>
                            {item.isAi && (
                                <span className="group-data-[collapsible=icon]:hidden ml-auto flex items-center gap-1 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 shrink-0">
                                    <Sparkles className="size-3" />
                                    AI
                                </span>
                            )}
                        </>
                    );

                    return (
                        <SidebarMenuItem key={item.title} id={item.tourId}>
                            <SidebarMenuButton
                                asChild
                                isActive={!item.isExternal && isCurrentUrl(item.href)}
                                tooltip={{ children: item.title }}
                            >
                                {item.isExternal ? (
                                    <a
                                        href={toUrl(item.href)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between w-full"
                                    >
                                        {content}
                                    </a>
                                ) : (
                                    <Link href={item.href} prefetch className="flex items-center justify-between w-full">
                                        {content}
                                    </Link>
                                )}
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
