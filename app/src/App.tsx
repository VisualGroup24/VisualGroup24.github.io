import { lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell";
import { DataNoteProvider } from "./components/DataNote";

const Home = lazy(() => import("./routes/Home"));
const Pulse = lazy(() => import("./routes/Pulse"));
const Explore = lazy(() => import("./routes/Explore"));
const Shortlist = lazy(() => import("./routes/Shortlist"));
const Methods = lazy(() => import("./routes/Methods"));

/** Legacy links keep their query string when they land in the journey. */
function RedirectTo({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

export default function App() {
  return (
    <DataNoteProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="market" element={<Pulse />} />
          <Route path="explore" element={<Explore />} />
          <Route path="shortlist" element={<Shortlist />} />
          <Route path="methods" element={<Methods />} />
          <Route path="districts" element={<RedirectTo to="/explore" />} />
          <Route path="budget" element={<RedirectTo to="/explore" />} />
          <Route path="affordability" element={<RedirectTo to="/explore" />} />
          <Route path="decide" element={<RedirectTo to="/shortlist" />} />
          <Route path="*" element={<RedirectTo to="/" />} />
        </Route>
      </Routes>
    </DataNoteProvider>
  );
}
