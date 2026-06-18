import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { paths } from "@/routes/paths";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { buildPreviewByDate } from "@/api/schedules";
import { holidayDates } from "@/api/meta";
import type { Schedule, ScheduleRun, StripChannelNumber } from "@/api/types";
import {
  useDeleteSchedule,
  useHolidays,
  useSchedulePreview,
  useScheduleRuns,
  useSchedules,
} from "@/hooks/useSchedules";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import { formatExecutedAt } from "@/utils/date";
import {
  endOfMonthKst,
  startOfMonthKst,
} from "@/utils/calendar";
import {
  formatDaysOfWeek,
  formatScheduleAction,
  formatTimeKst12h,
  parseChannelRouteParam,
} from "@/utils/schedule";
import {
  TOAST_DEVICE,
  TOAST_GUIDE,
  TOAST_RESOURCE,
} from "@/utils/toastMessages";
import { ScheduleMonthCalendar } from "./components/ScheduleMonthCalendar";
import styles from "./SchedulesPage.module.css";

export function SchedulesPage() {
  const { n } = useParams<{ n: string }>();
  const channel = parseChannelRouteParam(n);
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const from = startOfMonthKst(year, month);
  const to = endOfMonthKst(year, month);

  const { data, isLoading, isError, error, refetch } = useSchedules(
    channel ?? undefined,
  );
  const holidaysQuery = useHolidays(year);
  const previewQuery = useSchedulePreview(
    from,
    to,
    channel ?? undefined,
    channel != null,
  );
  const deleteMutation = useDeleteSchedule(channel ?? undefined);

  const previewByDate = useMemo(
    () => buildPreviewByDate(previewQuery.data),
    [previewQuery.data],
  );

  useQueryErrorToast({
    isError,
    error,
    resourceLabel: TOAST_RESOURCE.schedulesList,
    actionGuide: TOAST_GUIDE.retry,
  });
  useMutationErrorToast(
    deleteMutation,
    TOAST_DEVICE.schedule,
    TOAST_GUIDE.deleteRetry,
    "control",
  );

  if (channel == null) {
    return (
      <div className={styles.page}>
        <p className={styles.errorDetail}>잘못된 채널 번호입니다.</p>
        <Link to={paths.strip} className={styles.back}>
          ← 멀티탭
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={paths.strip} className={styles.back}>
          ← 멀티탭
        </Link>
        <h2 className={styles.title}>채널 {channel} 스케줄</h2>
      </header>

      <Card className={styles.calendarCard}>
        <p className={styles.calendarTitle}>실행 예정</p>
        <ScheduleMonthCalendar
          year={year}
          month={month}
          holidays={holidayDates(holidaysQuery.data)}
          previewByDate={previewByDate}
          onMonthChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
        {previewQuery.isLoading ? (
          <p className={styles.message}>미리보기 불러오는 중…</p>
        ) : null}
      </Card>

      <div className={styles.toolbar}>
        <Button
          onClick={() => navigate(paths.stripChannelSchedulesNew(channel))}
        >
          새 스케줄
        </Button>
      </div>

      {isLoading ? (
        <p className={styles.message}>목록 불러오는 중…</p>
      ) : null}

      {isError ? (
        <div>
          <p className={styles.errorDetail}>스케줄 목록 조회 실패</p>
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
                channel={channel}
                deleting={
                  deleteMutation.isPending &&
                  deleteMutation.variables === schedule.id
                }
                onEdit={() =>
                  navigate(paths.stripChannelScheduleEdit(channel, schedule.id))
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
        </Card>
      ) : null}
    </div>
  );
}

interface ScheduleItemProps {
  schedule: Schedule;
  channel: StripChannelNumber;
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
        {formatTimeKst12h(schedule.time_kst)} ·{" "}
        {formatDaysOfWeek(schedule.days_of_week)} ·{" "}
        {formatScheduleAction(schedule)}
      </p>
      {schedule.holiday_mode === "skip" ? (
        <p className={styles.itemHint}>공휴일 건너뜀</p>
      ) : null}
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
  useQueryErrorToast({
    isError: Boolean(error),
    error,
    resourceLabel: TOAST_RESOURCE.scheduleRuns,
    actionGuide: TOAST_GUIDE.retry,
  });

  if (loading) {
    return <p className={styles.itemMeta}>이력 불러오는 중…</p>;
  }
  if (error) {
    return <p className={styles.errorDetail}>실행 이력 조회 실패</p>;
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
          {run.scheduled_at ? (
            <>
              예정 {formatExecutedAt(run.scheduled_at)} → 실행{" "}
            </>
          ) : null}
          {formatExecutedAt(run.executed_at)} —{" "}
          {run.success ? "성공" : "실패"}
          {run.detail ? ` (${run.detail})` : ""}
        </li>
      ))}
    </ul>
  );
}
