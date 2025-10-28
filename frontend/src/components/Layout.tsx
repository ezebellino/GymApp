import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
