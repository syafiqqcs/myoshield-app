import { AppProvider, useApp } from "./lib/store";
import OnePage from "./components/OnePage";
import Landing from "./pages/Landing";
import Login from "./pages/Login";

function Router() {
  const { route, role, toast } = useApp();
  const Toast = () =>
    toast ? (
      <div
        role="status"
        className="font-mono fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-[2px] border border-[#FFCC00]/55 bg-[#121214] px-5 py-3 text-[10px] uppercase tracking-[0.12em] text-[#FFFFFF]"
      >
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-[1px] bg-[#FFCC00] align-middle" />
        {toast}
      </div>
    ) : null;
  if (route === "landing") return <Landing />;
  if (route === "login" || !role)
    return (
      <>
        <Login />
        <Toast />
      </>
    );
  return (
    <OnePage>
      <Toast />
    </OnePage>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
