import { Navigate } from 'react-router-dom';
import { useParentAuth } from '../../context/ParentAuthContext';

// `onboarding` marks the welcome route: a parent without a profile is sent
// there from everywhere else, and one with a profile is sent away from it.
export default function ParentRoute({ children, onboarding = false }) {
  const { parent, loading } = useParentAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-ninja-bg flex items-center justify-center">
        <p className="text-ninja-muted font-ninja text-xl">Loading...</p>
      </div>
    );
  }

  if (!parent) return <Navigate to="/login?tab=parent" replace />;
  if (!parent.onboarded && !onboarding) return <Navigate to="/parent/welcome" replace />;
  if (parent.onboarded && onboarding) return <Navigate to="/parent/dashboard" replace />;
  return children;
}
