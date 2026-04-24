import { Outlet } from "react-router-dom";

import Footer from "./Footer";
import Header from "./Header";

function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />
      <main className="flex-1 pt-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;
