import { LayoutGridIcon, ListTodoIcon } from 'lucide-react';

// Where a signed-in user lands, and what "back to my dashboard" means from the
// pages that sit outside the app shell. Directors land on the overview; the
// check-in board is a destination they choose, not the front door.
export function getHomePath(user, viewAs) {
  const isSenseiView = user?.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user?.role) && !isSenseiView;
  return isManager ? '/manager/overview' : '/sensei/dashboard';
}

// Bottom nav pill — also drives swipe navigation (Layout cycles these).
export function getMobileNavTabs(user, viewAs) {
  if (!user) return [];
  const isSenseiView = user.role === 'admin' && viewAs === 'sensei';
  const isManager = ['manager', 'admin'].includes(user.role) && !isSenseiView;
  const dashPath = isManager ? '/manager/dashboard' : '/sensei/dashboard';
  return [
    // Directors get a sixth tab. There is no flat art for it, so the nav draws
    // the same glyph the desktop sidebar uses.
    ...(isManager ? [{ to: '/manager/overview', label: 'Dashboard', iconId: null, Glyph: LayoutGridIcon }] : []),
    { to: dashPath, label: isManager ? 'Today' : 'Dashboard', iconId: isManager ? 'today' : null, Glyph: isManager ? undefined : LayoutGridIcon },
    ...(!isManager ? [{ to: '/sensei/tasks', label: 'Tasks', iconId: null, Glyph: ListTodoIcon }] : []),
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
