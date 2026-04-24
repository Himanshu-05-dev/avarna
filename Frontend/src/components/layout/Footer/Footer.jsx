import { Link } from "react-router-dom";
import AvaranaLogo from "../../common/AvaranaLogo/AvaranaLogo";

export default function Footer({ variant = "app" }) {
  return (
    <footer
      data-testid="site-footer"
      className="mt-16 w-full border-t border-slate-200 bg-white"
    >
      <div
        className={`mx-auto flex w-full ${
          variant === "landing" ? "max-w-[1440px]" : "max-w-full"
        } flex-col items-start justify-between gap-3 px-8 py-6 md:flex-row md:items-center`}
      >
        <div className="flex items-center gap-6 text-[13px]">
          <AvaranaLogo size={26} showName={true} showSub={false} inline={true} />
          <span className="hidden text-slate-400 md:inline">
            © {new Date().getFullYear()} Avarana. All rights reserved. Precision Auditing for the
            Modern Web.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-[13px] text-slate-500">
          <Link to="#" className="hover:text-slate-900">
            Privacy Policy
          </Link>
          <Link to="#" className="hover:text-slate-900">
            Terms of Service
          </Link>
          <Link to="#" className="hover:text-slate-900">
            Security Whitepaper
          </Link>
          <Link to="#" className="hover:text-slate-900">
            Contact Support
          </Link>
        </div>
      </div>
    </footer>
  );
}
