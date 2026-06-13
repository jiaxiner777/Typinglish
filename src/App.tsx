import { AdminApp } from "./app/admin/AdminApp";
import { PublicApp } from "./app/public/PublicApp";

export default function App() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return <AdminApp />;
  }

  return <PublicApp />;
}
