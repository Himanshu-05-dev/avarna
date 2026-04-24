import TopNav from "../TopNav/TopNav";
import Sidebar from "../Sidebar/Sidebar";
import Footer from "../Footer/Footer";
import "./AppLayout.scss";

export default function AppLayout({ children, sidebarFooter }) {
  return (
    <div className="app-layout">
      <TopNav />
      <div className="app-layout__content">
        <Sidebar footer={sidebarFooter} />
        <main className="app-layout__main">
          <div className="app-layout__container">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
