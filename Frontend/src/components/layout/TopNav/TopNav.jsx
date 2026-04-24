import { NavLink, Link } from "react-router-dom";
import { Bell, LogOut, User } from "lucide-react";
import { Input } from "../../../components/common/input";
import AvaranaLogo from "../../common/AvaranaLogo/AvaranaLogo";
import { useGetMe, useLogout } from "../../../features/auth/hooks/useAuth";
import { useState, useRef, useEffect } from "react";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Audits", to: "/audits" },
  { label: "Analysis", to: "/analysis" },
  { label: "Roadmap", to: "/roadmap" },
  { label: "Compliance", to: "/compliance" },
];

export default function TopNav({ showSearch = true }) {
  const { isAuthenticated, user } = useGetMe();
  const { logout } = useLogout();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
  };
  return (
    <header
      data-testid="top-nav"
      className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-8">
        <div className="flex items-center gap-12">
          <Link
            to="/"
            data-testid="brand-link"
            className="flex items-center"
            aria-label="Avarana home"
          >
            <AvaranaLogo size={34} showName={true} showSub={false} inline={true} />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {isAuthenticated && navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `relative text-[14px] font-medium transition-colors ${
                    isActive
                      ? "text-amber-700"
                      : "text-slate-600 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="absolute -bottom-[21px] left-0 right-0 h-[2px] rounded-full bg-amber-600" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {showSearch && (
            <div className="relative hidden md:block">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <Input
                data-testid="top-search"
                placeholder="Search audits..."
                className="h-9 w-[260px] rounded-lg border-slate-200 bg-white pl-9 text-sm"
              />
            </div>
          )}
          {!isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to="/login"
                data-testid="topnav-login"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Login
              </Link>
              <Link
                to="/register"
                data-testid="topnav-register"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-amber-600 px-3 text-sm font-medium text-white transition hover:bg-amber-700"
              >
                Register
              </Link>
            </div>
          ) : (
            <div className="relative flex items-center gap-4" ref={dropdownRef}>
              <button
                data-testid="notifications-btn"
                className="relative grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full bg-rose-500" />
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  data-testid="user-avatar"
                  className="grid h-9 w-9 place-items-center overflow-hidden rounded-full text-xs font-semibold text-white ring-2 ring-white hover:ring-slate-200 transition"
                  style={{ background: "linear-gradient(135deg, #1A102E, #2D1B6E)" }}
                >
                  {getInitials(user?.username)}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900 truncate">{user?.username || "User"}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User size={16} />
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
