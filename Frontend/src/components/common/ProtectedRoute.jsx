/**
 * ProtectedRoute — redirects to /login if not authenticated.
 * Runs getMeThunk on mount to rehydrate session from httpOnly cookie.
 */
import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getMeThunk, selectIsAuthenticated, selectAuthLoading, selectUser } from "../../features/auth/state/auth.slice";
import AvaranaLogo from "../../components/common/AvaranaLogo/AvaranaLogo";

export default function ProtectedRoute({ children }) {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const loading = useSelector(selectAuthLoading("getMe"));
  const [hasTried, setHasTried] = React.useState(false);
  const hasLoggedIn = localStorage.getItem("hasLoggedIn") === "true";

  useEffect(() => {
    // If we don't have the user object yet, fetch it
    if (!user) {
      dispatch(getMeThunk()).finally(() => {
        setHasTried(true);
      });
    } else {
      setHasTried(true);
    }
  }, [dispatch, user]);

  if (hasTried && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Show loading screen ONLY if not optimistically logged in
  if ((loading || !hasTried) && !hasLoggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050310",
        }}
      >
        <AvaranaLogo size={64} showName={true} showSub={true} inline={false} />
      </div>
    );
  }

  return children;
}
