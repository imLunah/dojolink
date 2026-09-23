import { Fragment } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SkeletonShell } from '../ui/Skeleton';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <SkeletonShell />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'manager' && !['manager', 'admin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (role === 'sensei' && !['manager', 'sensei', 'admin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (role === 'admin' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Keyed on the active center so a location switch remounts the page: every staff
  // request is scoped to that center server-side, and a page that fetched once on
  // mount would otherwise keep showing (and submitting against) the old one.
  return <Fragment key={user.activeLocation?.id ?? 'none'}>{children}</Fragment>;
}
