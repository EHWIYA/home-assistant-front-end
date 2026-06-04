import { Outlet } from "react-router-dom";

/** `/strip/*` 중첩 라우트 — 공통 Outlet (탭·헤더는 AppShell) */
export function StripLayout() {
  return <Outlet />;
}
