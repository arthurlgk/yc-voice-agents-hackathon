import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";

// Home stays in the entry bundle (it's the default route and owns the live
// call). Secondary pages are split into their own chunks.
import HomePage from "./pages/HomePage";
const CallsOrdersPage = lazy(() => import("./pages/CallsOrdersPage"));

function RouteFallback() {
  return (
    <div className="animate-pulse space-y-4 p-2">
      <div className="h-7 w-48 rounded-md bg-cream" />
      <div className="h-4 w-80 rounded-md bg-cream/70" />
      <div className="mt-6 h-[420px] w-full rounded-2xl bg-cream/60" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route
          path="calls"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CallsOrdersPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
