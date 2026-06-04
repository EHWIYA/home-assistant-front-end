import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { AcPage } from "@/features/ac/AcPage";
import { HomePage } from "@/features/home/HomePage";
import { PcPage } from "@/features/pc/PcPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ScheduleFormPage } from "@/features/strip/ScheduleFormPage";
import { SchedulesPage } from "@/features/strip/SchedulesPage";
import { StripLayout } from "@/features/strip/StripLayout";
import { StripPage } from "@/features/strip/StripPage";
import { routeHandles } from "@/routes/handles";
import { paths } from "@/routes/paths";

/** Data Router — `useMatches`·Route `handle` 사용 (BrowserRouter 단독 불가) */
export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage />, handle: routeHandles.home },
      { path: "ac", element: <AcPage />, handle: routeHandles.ac },
      { path: "pc", element: <PcPage />, handle: routeHandles.pc },
      {
        path: "settings",
        element: <SettingsPage />,
        handle: routeHandles.settings,
      },
      {
        path: "strip",
        element: <StripLayout />,
        handle: routeHandles.strip,
        children: [
          { index: true, element: <StripPage /> },
          {
            path: "schedules",
            element: <SchedulesPage />,
            handle: routeHandles.stripSchedules,
          },
          {
            path: "schedules/new",
            element: <ScheduleFormPage />,
            handle: routeHandles.stripScheduleNew,
          },
          {
            path: "schedules/:id/edit",
            element: <ScheduleFormPage />,
            handle: routeHandles.stripScheduleEdit,
          },
        ],
      },
      { path: "*", element: <Navigate to={paths.home} replace /> },
    ],
  },
]);
