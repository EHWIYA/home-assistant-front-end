import shared from "@/components/status/statusPage.module.css";
import { SettingsAboutPanel } from "./components/SettingsAboutPanel";
import { SettingsAccessPanel } from "./components/SettingsAccessPanel";
import { SettingsQuickLinksPanel } from "./components/SettingsQuickLinksPanel";
import { SettingsStatusHero } from "./components/SettingsStatusHero";

export function SettingsPage() {
  return (
    <div className={shared.page}>
      <SettingsStatusHero />
      <SettingsQuickLinksPanel />
      <SettingsAccessPanel />
      <SettingsAboutPanel />
    </div>
  );
}
