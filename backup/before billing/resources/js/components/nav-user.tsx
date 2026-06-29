import { usePage } from '@inertiajs/react';
import { ChevronsUpDown, Crown, Zap } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { useIsMobile } from '@/hooks/use-mobile';

export function NavUser() {
    const { auth } = usePage<{ auth: { user: any; subscription: { hasActiveAccess: boolean; isPremium: boolean; hasAiAccess: boolean; isOnTrial: boolean } | null } }>().props;
    const { state } = useSidebar();
    const isMobile = useIsMobile();

    if (!auth.user) {
        return null;
    }

    const sub = auth.subscription;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="group text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent"
                            data-test="sidebar-menu-button"
                        >
                            <UserInfo user={auth.user} />
                            {/* Payment temporarily disabled — subscription badges hidden
                            {sub?.isPremium && (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 group-data-[collapsible=icon]:hidden">
                                    <Crown className="size-3" />
                                    Prémium
                                </span>
                            )}
                            {!sub?.isPremium && sub?.isOnTrial && (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 group-data-[collapsible=icon]:hidden">
                                    <Zap className="size-3" />
                                    Trial
                                </span>
                            )}
                            {!sub?.isPremium && !sub?.isOnTrial && sub?.hasActiveAccess && (
                                <span className="ml-auto flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400 group-data-[collapsible=icon]:hidden">
                                    Alap
                                </span>
                            )}
                            */}
                            <ChevronsUpDown className="size-4 shrink-0" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        align="end"
                        side={
                            isMobile
                                ? 'bottom'
                                : state === 'collapsed'
                                  ? 'left'
                                  : 'bottom'
                        }
                    >
                        <UserMenuContent user={auth.user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
