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

  return children;
}
