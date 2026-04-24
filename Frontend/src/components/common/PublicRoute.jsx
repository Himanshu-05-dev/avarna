import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getMeThunk, selectIsAuthenticated, selectAuthLoading, selectUser } from "../../features/auth/state/auth.slice";
import AvaranaLogo from "../../components/common/AvaranaLogo/AvaranaLogo";

export default function PublicRoute({ children }) {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const loading = useSelector(selectAuthLoading("getMe"));
  const [hasTried, setHasTried] = React.useState(false);
  const hasLoggedIn = localStorage.getItem("hasLoggedIn") === "true";

  useEffect(() => {
    if (!user && hasLoggedIn) {
      dispatch(getMeThunk()).finally(() => {
        setHasTried(true);
      });
    } else {
      setHasTried(true);
    }
  }, [dispatch, user, hasLoggedIn]);

  if (hasTried && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading && hasLoggedIn && !hasTried) {
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
