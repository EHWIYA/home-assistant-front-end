import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { paths } from "@/routes/paths";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { ScheduleCreateBody, StripChannelNumber } from "@/api/types";
import {
  useCreateSchedule,
  usePatchSchedule,
  useSchedules,
} from "@/hooks/useSchedules";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import {
  TOAST_DEVICE,
  TOAST_GUIDE,
  TOAST_RESOURCE,
} from "@/utils/toastMessages";
import {
  DEFAULT_SCHEDULE_FORM,
  isValidTimeKst,
  WEEKDAY_LABELS,
} from "@/utils/schedule";
import styles from "./ScheduleFormPage.module.css";

export function ScheduleFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const schedulesQuery = useSchedules();
  const createMutation = useCreateSchedule();
  const patchMutation = usePatchSchedule();

  const [name, setName] = useState(DEFAULT_SCHEDULE_FORM.name);
  const [enabled, setEnabled] = useState(DEFAULT_SCHEDULE_FORM.enabled);
  const [channelNumber, setChannelNumber] = useState<StripChannelNumber>(
    DEFAULT_SCHEDULE_FORM.channel_number,
  );
  const [channelOn, setChannelOn] = useState(DEFAULT_SCHEDULE_FORM.channel_on);
  const [timeKst, setTimeKst] = useState(DEFAULT_SCHEDULE_FORM.time_kst);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    DEFAULT_SCHEDULE_FORM.days_of_week,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !id || !schedulesQuery.data) return;
    const found = schedulesQuery.data.find((s) => s.id === id);
    if (!found) return;
    setName(found.name);
    setEnabled(found.enabled);
    setTimeKst(found.time_kst);
    setDaysOfWeek([...found.days_of_week]);
    if (found.action_type === "channel") {
      setChannelNumber((found.channel_number ?? 1) as StripChannelNumber);
      setChannelOn(found.channel_on ?? true);
    }
  }, [isEdit, id, schedulesQuery.data]);

  const pending = createMutation.isPending || patchMutation.isPending;
  const mutationError = createMutation.error ?? patchMutation.error;
  useQueryErrorToast({
    isError: isEdit && schedulesQuery.isError,
    error: schedulesQuery.error,
    resourceLabel: TOAST_RESOURCE.schedules,
    actionGuide: TOAST_GUIDE.backToListAndRetry,
  });
  useMutationErrorToast(
    createMutation,
    TOAST_DEVICE.schedule,
    TOAST_GUIDE.saveRetry,
    "control",
  );
  useMutationErrorToast(
    patchMutation,
    TOAST_DEVICE.schedule,
    TOAST_GUIDE.saveRetry,
    "control",
  );

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function buildBody(): ScheduleCreateBody | null {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("이름을 입력하세요.");
      return null;
    }
    if (!isValidTimeKst(timeKst)) {
      setValidationError("시간은 HH:MM 형식(00:00~23:59)이어야 합니다.");
      return null;
    }
    if (daysOfWeek.length === 0) {
      setValidationError("요일을 하나 이상 선택하세요.");
      return null;
    }
    setValidationError(null);
    return {
      name: trimmed,
      enabled,
      action_type: "channel",
      channel_number: channelNumber,
      channel_on: channelOn,
      time_kst: timeKst,
      days_of_week: [...daysOfWeek].sort((a, b) => a - b),
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = buildBody();
    if (!body) return;

    if (isEdit && id) {
      patchMutation.mutate(
        { id, body },
        { onSuccess: () => navigate(paths.stripSchedules) },
      );
    } else {
      createMutation.mutate(body, {
        onSuccess: () => navigate(paths.stripSchedules),
      });
    }
  }

  if (isEdit && schedulesQuery.isLoading) {
    return <p className={styles.hint}>스케줄 불러오는 중…</p>;
  }

  if (isEdit && schedulesQuery.isError) {
    return (
      <div className={styles.page}>
        <p className={styles.errorDetail}>스케줄 조회 실패</p>
        <Link to={paths.stripSchedules} className={styles.back}>
          목록으로
        </Link>
      </div>
    );
  }

  if (isEdit && id && schedulesQuery.data && !schedulesQuery.data.some((s) => s.id === id)) {
    return (
      <div className={styles.page}>
        <p className={styles.errorDetail}>스케줄을 찾을 수 없습니다.</p>
        <Link to={paths.stripSchedules} className={styles.back}>
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to={paths.stripSchedules} className={styles.back}>
        ← 스케줄 목록
      </Link>
      <h2 className={styles.title}>
        {isEdit ? "스케줄 수정" : "새 스케줄"}
      </h2>

      <Card>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="schedule-name">
              이름
            </label>
            <input
              id="schedule-name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 아침 콘센트"
              maxLength={80}
            />
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            활성화
          </label>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="schedule-time">
                시간 (KST)
              </label>
              <input
                id="schedule-time"
                type="time"
                className={styles.input}
                value={timeKst}
                onChange={(e) => setTimeKst(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="schedule-channel">
                채널
              </label>
              <select
                id="schedule-channel"
                className={styles.select}
                value={channelNumber}
                onChange={(e) =>
                  setChannelNumber(Number(e.target.value) as StripChannelNumber)
                }
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    채널 {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>동작</span>
            <select
              className={styles.select}
              value={channelOn ? "on" : "off"}
              onChange={(e) => setChannelOn(e.target.value === "on")}
            >
              <option value="on">켜기 (ON)</option>
              <option value="off">끄기 (OFF)</option>
            </select>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>요일 (월=0 … 일=6)</span>
            <div className={styles.days}>
              {WEEKDAY_LABELS.map((label, day) => (
                <label
                  key={label}
                  className={`${styles.dayChip} ${
                    daysOfWeek.includes(day) ? styles.dayChipActive : ""
                  }`.trim()}
                >
                  <input
                    type="checkbox"
                    checked={daysOfWeek.includes(day)}
                    onChange={() => toggleDay(day)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <p className={styles.hint}>
            프리셋 스케줄은 DB 시드 후 지원 예정입니다. 현재는 채널
            제어만 등록할 수 있습니다.
          </p>

          {validationError ? (
            <p className={styles.errorDetail}>{validationError}</p>
          ) : null}
          {mutationError ? <p className={styles.errorDetail}>저장 실패</p> : null}

          <div className={styles.actions}>
            <Button type="submit" fullWidth disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={pending}
              onClick={() => navigate(paths.stripSchedules)}
            >
              취소
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
