import AchievementToast from '@/components/achievement-toast';
import AiBudgetBanner from '@/components/ai-budget-banner';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import BetaBanner from '@/components/beta-banner';
import FlashToast from '@/components/flash-toast';
import OnboardingTour from '@/components/onboarding-tour';
import StreakCelebration from '@/components/streak-celebration';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="overflow-x-hidden">
                <BetaBanner />
                <AiBudgetBanner />
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {children}
            </AppContent>
            <StreakCelebration />
            <AchievementToast />
            <FlashToast />
            <OnboardingTour />
        </AppShell>
    );
}
