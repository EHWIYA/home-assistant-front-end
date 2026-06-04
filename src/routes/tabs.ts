import desktopSvg from "cupertino-icons-svg/svg/desktopcomputer.svg?raw";
import snowSvg from "cupertino-icons-svg/svg/snow.svg?raw";
import houseSvg from "cupertino-icons-svg/svg/house.svg?raw";
import houseFillSvg from "cupertino-icons-svg/svg/house_fill.svg?raw";
import powerSvg from "cupertino-icons-svg/svg/power.svg?raw";
import gearSvg from "cupertino-icons-svg/svg/gear.svg?raw";
import gearFillSvg from "cupertino-icons-svg/svg/gear_alt_fill.svg?raw";
import { paths } from "@/routes/paths";

export type MainTabId = "pc" | "ac" | "home" | "strip" | "settings";

export interface MainTabConfig {
  id: MainTabId;
  to: string;
  label: string;
  icon: string;
  iconActive?: string;
  /** NavLink `end` — false면 하위 경로에서도 활성 (멀티탭) */
  end?: boolean;
}

/** 하단 탭바 — 순서·경로·아이콘 단일 정의 (`AppShell`에서 NavLink `replace` 적용) */
export const MAIN_TABS: readonly MainTabConfig[] = [
  {
    id: "pc",
    to: paths.pc,
    label: "PC",
    icon: desktopSvg,
    end: true,
  },
  {
    id: "ac",
    to: paths.ac,
    label: "에어컨",
    icon: snowSvg,
    end: true,
  },
  {
    id: "home",
    to: paths.home,
    label: "홈",
    icon: houseSvg,
    iconActive: houseFillSvg,
    end: true,
  },
  {
    id: "strip",
    to: paths.strip,
    label: "멀티탭",
    icon: powerSvg,
    end: false,
  },
  {
    id: "settings",
    to: paths.settings,
    label: "설정",
    icon: gearSvg,
    iconActive: gearFillSvg,
    end: true,
  },
] as const;
