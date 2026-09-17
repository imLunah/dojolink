import { Navigate } from 'react-router-dom';
import { useParentAuth } from '../../context/ParentAuthContext';
import { SkeletonShell } from '../ui/Skeleton';

// `onboarding` marks the welcome route: a parent without a profile is sent
// there from everywhere else, and one with a profile is sent away from it.
export default function ParentRoute({ children, onboarding = false }) {
  const { parent, loading } = useParentAuth();

  if (loading) {
    return <SkeletonShell portal />;
  }

  if (!parent) return <Navigate to="/login?tab=parent" replace />;
  if (!parent.onboarded && !onboarding) return <Navigate to="/parent/welcome" replace />;
  if (parent.onboarded && onboarding) return <Navigate to="/parent/dashboard" replace />;
  return children;
}
