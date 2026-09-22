import { LayoutGridIcon } from 'lucide-react';

// Where a signed-in user lands, and what "back to my dashboard" means from the
// pages that sit outside the app shell. Everyone on staff lands on the
// overview; the check-in board is a destination they choose, not the front
// door, and that now holds for senseis as well as directors.
export function getHomePath() {
  return '/manager/overview';
}

// Bottom nav pill — also drives swipe navigation (Layout cycles these).
export function getMobileNavTabs(user, viewAs) {
  if (!user) return [];
  const isSenseiView = user.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user.role) && !isSenseiView;
  const dashPath = isManager ? '/manager/dashboard' : '/sensei/dashboard';
  return [
    // Everyone gets the dashboard tab now that senseis have the page too. It
    // took the slot the sensei Tasks tab held; My Tasks still rides the top
    // bar's left corner for them. There is no flat art for it, so the nav
    // draws the same glyph the desktop sidebar uses.
    { to: '/manager/overview', label: 'Dashboard', iconId: null, Glyph: LayoutGridIcon },
    { to: dashPath, label: 'Today', iconId: 'today' },
    { to: '/manager/students', label: 'Ninjas', iconId: 'roster' },
    { to: '/clubs', label: 'Clubs', iconId: 'clubs' },
    { to: '/manager/staff', label: 'Staff', iconId: 'staff' },
    { to: '/account', label: 'Account', iconId: null },
  ];
}

// Top bar — occasional/reference destinations, in the screen corners (IG-style).
export function getTopNavTabs(user, viewAs) {
  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user?.role) && !isSenseiView;
  return {
    // CDs get the Dashboard here; senseis get their assigned work.
    left: isManager
      ? { to: '/manager/overview', label: 'Dashboard', iconId: 'dashboard' }
      : { to: '/sensei/tasks', label: 'My Tasks', iconId: 'report' },
    right: { to: '/curriculum-roadmap', label: 'Roadmap', iconId: 'roadmap' },
  };
}

export function getActiveTabIndex(tabs, pathname) {
  for (let i = 0; i < tabs.length; i++) {
    if (pathname === tabs[i].to || pathname.startsWith(tabs[i].to + '/')) return i;
  }
  return -1;
}
