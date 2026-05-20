import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Schedule, ScheduleRun } from "@/api/types";
import {
  useDeleteSchedule,
  useScheduleRuns,
  useSchedules,
} from "@/hooks/useSchedules";
import { formatApiError } from "@/utils/apiMessages";
import { formatExecutedAt } from "@/utils/date";
import {
  formatDaysOfWeek,
  formatScheduleAction,
} from "@/utils/schedule";
import styles from "./SchedulesPage.module.css";

export function SchedulesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useSchedules();
  const deleteMutation = useDeleteSchedule();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/strip" className={styles.back}>
          ← 멀티탭
        </Link>
        <h2 className={styles.title}>스케줄</h2>
      </header>

      <div className={styles.toolbar}>
        <Button onClick={() => navigate("/strip/schedules/new")}>
          새 스케줄
        </Button>
      </div>

      {isLoading ? (
        <p className={styles.message}>목록 불러오는 중…</p>
      ) : null}

      {isError ? (
        <div>
          <p className={styles.errorDetail}>
            {formatApiError(error, "목록을 불러올 수 없습니다")}
          </p>
          <Button onClick={() => void refetch()}>다시 시도</Button>
        </div>
      ) : null}

      {!isLoading && !isError && data?.length === 0 ? (
        <Card>
          <p className={styles.empty}>등록된 스케줄이 없습니다.</p>
        </Card>
      ) : null}

      {!isLoading && !isError && data && data.length > 0 ? (
        <Card>
          <ul className={styles.list}>
            {data.map((schedule) => (
              <ScheduleItem
                key={schedule.id}
                schedule={schedule}
                deleting={
                  deleteMutation.isPending &&
                  deleteMutation.variables === schedule.id
                }
                onEdit={() =>
                  navigate(`/strip/schedules/${schedule.id}/edit`)
                }
                onDelete={() => {
                  if (
                    window.confirm(
                      `「${schedule.name}」 스케줄을 삭제할까요?`,
                    )
                  ) {
                    deleteMutation.mutate(schedule.id);
                  }
                }}
              />
            ))}
          </ul>
          {deleteMutation.isError ? (
            <p className={styles.errorDetail}>
              {formatApiError(deleteMutation.error, "삭제 실패")}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

interface ScheduleItemProps {
  schedule: Schedule;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function ScheduleItem({
  schedule,
  deleting,
  onEdit,
  onDelete,
}: ScheduleItemProps) {
  const [showRuns, setShowRuns] = useState(false);
  const runsQuery = useScheduleRuns(schedule.id, showRuns);

  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <p className={styles.itemName}>{schedule.name}</p>
        {!schedule.enabled ? (
          <span className={styles.badgeOff}>비활성</span>
        ) : null}
      </div>
      <p className={styles.itemMeta}>
        {schedule.time_kst} · {formatDaysOfWeek(schedule.days_of_week)} ·{" "}
        {formatScheduleAction(schedule)}
      </p>
      <div className={styles.itemActions}>
        <Button variant="secondary" onClick={onEdit}>
          수정
        </Button>
        <Button variant="danger" disabled={deleting} onClick={onDelete}>
          {deleting ? "삭제 중…" : "삭제"}
        </Button>
        <button
          type="button"
          className={styles.runsToggle}
          onClick={() => setShowRuns((v) => !v)}
        >
          {showRuns ? "실행 이력 숨기기" : "실행 이력"}
        </button>
      </div>
      {showRuns ? (
        <RunsPanel
          loading={runsQuery.isLoading}
          error={runsQuery.error}
          runs={runsQuery.data}
        />
      ) : null}
    </li>
  );
}

interface RunsPanelProps {
  loading: boolean;
  error: unknown;
  runs: ScheduleRun[] | undefined;
}

function RunsPanel({ loading, error, runs }: RunsPanelProps) {
  if (loading) {
    return <p className={styles.itemMeta}>이력 불러오는 중…</p>;
  }
  if (error) {
    return (
      <p className={styles.errorDetail}>
        {formatApiError(error, "이력을 불러올 수 없습니다")}
      </p>
    );
  }
  if (!runs?.length) {
    return <p className={styles.itemMeta}>실행 이력이 없습니다.</p>;
  }
  return (
    <ul className={styles.runsList}>
      {runs.map((run, i) => (
        <li
          key={run.id ?? `${run.executed_at}-${i}`}
          className={run.success ? styles.runOk : styles.runFail}
        >
          {formatExecutedAt(run.executed_at)} —{" "}
          {run.success ? "성공" : "실패"}
          {run.detail ? ` (${run.detail})` : ""}
        </li>
      ))}
    </ul>
  );
}
