import React from 'react';
import {
  Shield,
  FileText,
  AlertOctagon,
  GitCompare,
  MessageSquare,
  CheckSquare,
  Lock,
} from 'lucide-react';

export type ActiveTab =
  | 'documents'
  | 'overview'
  | 'risks'
  | 'compare'
  | 'ask'
  | 'action-plan'
  | 'privacy';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hasDocument: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, hasDocument }) => {
  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    requiresDoc: boolean;
  }> = [
    {
      id: 'documents',
      label: 'Documents',
      icon: <FileText className="w-4 h-4" aria-hidden="true" />,
      requiresDoc: false,
    },
    {
      id: 'overview',
      label: 'Overview',
      icon: <Shield className="w-4 h-4" aria-hidden="true" />,
      requiresDoc: true,
    },
    {
      id: 'risks',
      label: 'Risks & Obligations',
      icon: <AlertOctagon className="w-4 h-4" aria-hidden="true" />,
      requiresDoc: true,
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: <GitCompare className="w-4 h-4" aria-hidden="true" />,
      requiresDoc: false,
    },
    {
      id: 'ask',
      label: 'Ask',
      icon: <MessageSquare className="w-4 h-4" aria-hidden="true" />,
      requiresDoc: true,
    },
    {
      id: 'action-plan',
      label: 'Action Plan',
      icon: <CheckSquare className="w-4 h-4" aria-hidden="true" />,
      requiresDoc: true,
    },
    {
      id: 'privacy',
      label: 'Privacy & Limits',
      icon: <Lock className="w-4 h-4" aria-hidden="true" />,
      requiresDoc: false,
    },
  ];

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-lg tracking-wider shadow-sm">
              LG
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                LexiGuard
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                Evidence-First AI
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav
            className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2"
            aria-label="Main Navigation"
            role="tablist"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const isDisabled = item.requiresDoc && !hasDocument;

              return (
                <button
                  key={item.id}
                  role="tab"
                  id={`nav-tab-${item.id}`}
                  aria-controls={`panel-${item.id}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => !isDisabled && onTabChange(item.id)}
                  disabled={isDisabled}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                      : isDisabled
                        ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.icon}
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
