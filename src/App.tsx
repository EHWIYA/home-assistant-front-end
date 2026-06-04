import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { AcPage } from "@/features/ac/AcPage";
import { HomePage } from "@/features/home/HomePage";
import { PcPage } from "@/features/pc/PcPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ScheduleFormPage } from "@/features/strip/ScheduleFormPage";
import { SchedulesPage } from "@/features/strip/SchedulesPage";
import { StripPage } from "@/features/strip/StripPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="ac" element={<AcPage />} />
          <Route path="pc" element={<PcPage />} />
          <Route path="strip" element={<StripPage />} />
          <Route path="strip/schedules" element={<SchedulesPage />} />
          <Route path="strip/schedules/new" element={<ScheduleFormPage />} />
          <Route
            path="strip/schedules/:id/edit"
            element={<ScheduleFormPage />}
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
