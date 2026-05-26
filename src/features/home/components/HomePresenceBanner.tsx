import { Badge } from "@/components/status/Badge";
import type { PersonStatus } from "@/api/types";
import styles from "./HomePresenceBanner.module.css";

interface HomePresenceBannerProps {
  person: PersonStatus;
}

export function HomePresenceBanner({ person }: HomePresenceBannerProps) {
  if (!person.state) return null;

  return (
    <div className={styles.banner}>
      <span className={styles.label}>재실</span>
      <Badge variant="ok">{person.state}</Badge>
    </div>
  );
}
