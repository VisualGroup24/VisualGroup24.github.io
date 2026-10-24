import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { DataInfoProvider } from "./components/DataInfo";

const Overview = lazy(() => import("./routes/Overview"));
const Market = lazy(() => import("./routes/Market"));
const Districts = lazy(() => import("./routes/Districts"));
const Affordability = lazy(() => import("./routes/Affordability"));
const Methods = lazy(() => import("./routes/Methods"));

export default function App() {
  return (
    <DataInfoProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="market" element={<Market />} />
          <Route path="districts" element={<Districts />} />
          <Route path="affordability" element={<Affordability />} />
          <Route path="methods" element={<Methods />} />
          <Route path="*" element={<Overview />} />
        </Route>
      </Routes>
    </DataInfoProvider>
  );
}
