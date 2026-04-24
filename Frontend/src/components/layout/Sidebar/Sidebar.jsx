import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Settings,
  BarChart3,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import AvaranaLogo from "../../common/AvaranaLogo/AvaranaLogo";
import { useGetMe } from "../../../features/auth/hooks/useAuth";
import "./Sidebar.scss";

const links = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutGrid, id: "dashboard" },
  { label: "Config", to: "/config", icon: Settings, id: "config" },
  { label: "Analysis", to: "/analysis", icon: BarChart3, id: "analysis" },
  { label: "Roadmap", to: "/roadmap", icon: LineChart, id: "roadmap" },
  { label: "Compliance", to: "/compliance", icon: ShieldCheck, id: "compliance" },
];

export default function Sidebar({ footer }) {
  const { isAuthenticated } = useGetMe();

  return (
    <aside data-testid="sidebar" className="sidebar">
      <div>
        {/* ── Brand ── */}
        <div className="sidebar__brand">
          <AvaranaLogo size={38} showName={true} showSub={true} inline={true} />
        </div>

        <nav className="sidebar__nav">
          {/* eslint-disable-next-line no-unused-vars */}
          {isAuthenticated && links.map(({ label, to, icon: Icon, id }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`sidebar-${id}`}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? "sidebar__link--active" : "sidebar__link--inactive"}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`sidebar__link-icon ${
                      isActive ? "sidebar__link-icon--active" : "sidebar__link-icon--inactive"
                    }`}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {footer && <div className="sidebar__footer">{footer}</div>}
    </aside>
  );
}
