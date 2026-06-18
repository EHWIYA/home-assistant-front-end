import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { paths } from "@/routes/paths";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { holidayDates } from "@/api/meta";
import type {
  ScheduleActionType,
  ScheduleCreateBody,
  ScheduleHolidayMode,
  StripChannelNumber,
} from "@/api/types";
import {
  useCreateSchedule,
  useHolidays,
  usePatchSchedule,
  useSchedules,
  useStripPresets,
} from "@/hooks/useSchedules";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import {
  endOfMonthKst,
  startOfMonthKst,
} from "@/utils/calendar";
import {
  DEFAULT_SCHEDULE_FORM,
  HOLIDAY_MODE_LABELS,
  isValidTimeKst,
  parseChannelRouteParam,
  WEEKDAY_LABELS,
} from "@/utils/schedule";
import {
  TOAST_DEVICE,
  TOAST_GUIDE,
  TOAST_RESOURCE,
} from "@/utils/toastMessages";
import { ScheduleMonthCalendar } from "./components/ScheduleMonthCalendar";
import { TimeKstPicker12h } from "./components/TimeKstPicker12h";
import shared from "@/components/status/statusPage.module.css";
import styles from "./ScheduleFormPage.module.css";

export function ScheduleFormPage() {
  const { n, id } = useParams<{ n?: string; id?: string }>();
  const routeChannel = parseChannelRouteParam(n);
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());

  const schedulesQuery = useSchedules(routeChannel ?? undefined);
  const presetsQuery = useStripPresets();
  const holidaysQuery = useHolidays(calendarYear);
  const createMutation = useCreateSchedule(routeChannel ?? undefined);
  const patchMutation = usePatchSchedule(routeChannel ?? undefined);

  const [name, setName] = useState(DEFAULT_SCHEDULE_FORM.name);
  const [enabled, setEnabled] = useState(DEFAULT_SCHEDULE_FORM.enabled);
  const [actionType, setActionType] = useState<ScheduleActionType>(
    DEFAULT_SCHEDULE_FORM.action_type,
  );
  const [channelNumber, setChannelNumber] = useState<StripChannelNumber>(
    routeChannel ?? DEFAULT_SCHEDULE_FORM.channel_number,
  );
  const [channelOn, setChannelOn] = useState(DEFAULT_SCHEDULE_FORM.channel_on);
  const [presetName, setPresetName] = useState(DEFAULT_SCHEDULE_FORM.preset_name);
  const [timeKst, setTimeKst] = useState(DEFAULT_SCHEDULE_FORM.time_kst);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    DEFAULT_SCHEDULE_FORM.days_of_week,
  );
  const [holidayMode, setHolidayMode] = useState<ScheduleHolidayMode>(
    DEFAULT_SCHEDULE_FORM.holiday_mode,
  );
  const [includeSubstitute, setIncludeSubstitute] = useState(
    DEFAULT_SCHEDULE_FORM.include_substitute,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const editSchedule = useMemo(
    () => schedulesQuery.data?.find((s) => s.id === id),
    [schedulesQuery.data, id],
  );

  useEffect(() => {
    if (routeChannel != null) {
      setChannelNumber(routeChannel);
      if (actionType === "channel") return;
    }
  }, [routeChannel, actionType]);

  useEffect(() => {
    if (!isEdit || !id || !editSchedule) return;
    setName(editSchedule.name);
    setEnabled(editSchedule.enabled);
    setActionType(editSchedule.action_type);
    setTimeKst(editSchedule.time_kst);
    setDaysOfWeek([...editSchedule.days_of_week]);
    setHolidayMode(editSchedule.holiday_mode ?? "skip");
    setIncludeSubstitute(editSchedule.include_substitute ?? true);
    if (editSchedule.action_type === "channel") {
      setChannelNumber((editSchedule.channel_number ?? 1) as StripChannelNumber);
      setChannelOn(editSchedule.channel_on ?? true);
    } else {
      setPresetName(editSchedule.preset_name ?? "");
    }
  }, [isEdit, id, editSchedule]);

  const listPath =
    routeChannel != null
      ? paths.stripChannelSchedules(routeChannel)
      : paths.stripChannelSchedules(1);

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

  if (isEdit && !n && editSchedule?.channel_number) {
    const ch = editSchedule.channel_number as StripChannelNumber;
    return (
      <Navigate
        to={paths.stripChannelScheduleEdit(ch, id!)}
        replace
      />
    );
  }

  function toggleWeekday(weekday: number) {
    setDaysOfWeek((prev) =>
      prev.includes(weekday)
        ? prev.filter((d) => d !== weekday)
        : [...prev, weekday],
    );
  }

  function buildBody(): ScheduleCreateBody | null {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("이름을 입력하세요.");
      return null;
    }
    if (!isValidTimeKst(timeKst)) {
      setValidationError("시간 형식이 올바르지 않습니다.");
      return null;
    }
    if (daysOfWeek.length === 0) {
      setValidationError("요일을 하나 이상 선택하세요. 달력에서 날짜를 눌러 요일을 지정할 수 있습니다.");
      return null;
    }
    if (actionType === "preset" && !presetName.trim()) {
      setValidationError("프리셋을 선택하세요.");
      return null;
    }
    if (routeChannel != null && actionType === "preset") {
      setValidationError("채널 스케줄 화면에서는 채널 제어만 등록할 수 있습니다.");
      return null;
    }
    setValidationError(null);

    const common = {
      name: trimmed,
      enabled,
      time_kst: timeKst,
      days_of_week: [...daysOfWeek].sort((a, b) => a - b),
      recurrence_type: "weekly" as const,
      holiday_mode: holidayMode,
      include_substitute: includeSubstitute,
    };

    if (actionType === "preset") {
      return {
        ...common,
        action_type: "preset",
        preset_name: presetName.trim(),
      };
    }

    return {
      ...common,
      action_type: "channel",
      channel_number: channelNumber,
      channel_on: channelOn,
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const body = buildBody();
    if (!body) return;

    if (isEdit && id) {
      patchMutation.mutate(
        { id, body },
        { onSuccess: () => navigate(listPath) },
      );
    } else {
      createMutation.mutate(body, {
        onSuccess: () => navigate(listPath),
      });
    }
  }

  if (routeChannel == null && n != null) {
    return (
      <div className={`${styles.page} ${shared.pageForm}`.trim()}>
        <p className={styles.errorDetail}>잘못된 채널 번호입니다.</p>
        <Link to={paths.strip} className={styles.back}>
          멀티탭으로
        </Link>
      </div>
    );
  }

  if (isEdit && schedulesQuery.isLoading) {
    return <p className={styles.hint}>스케줄 불러오는 중…</p>;
  }

  if (isEdit && schedulesQuery.isError) {
    return (
      <div className={`${styles.page} ${shared.pageForm}`.trim()}>
        <p className={styles.errorDetail}>스케줄 조회 실패</p>
        <Link to={listPath} className={styles.back}>
          목록으로
        </Link>
      </div>
    );
  }

  if (isEdit && id && schedulesQuery.data && !editSchedule) {
    return (
      <div className={`${styles.page} ${shared.pageForm}`.trim()}>
        <p className={styles.errorDetail}>스케줄을 찾을 수 없습니다.</p>
        <Link to={listPath} className={styles.back}>
          목록으로
        </Link>
      </div>
    );
  }

  const previewFrom = startOfMonthKst(calendarYear, calendarMonth);
  const previewTo = endOfMonthKst(calendarYear, calendarMonth);

  return (
    <div className={`${styles.page} ${shared.pageForm}`.trim()}>
      <Link to={listPath} className={styles.back}>
        ← 스케줄 목록
      </Link>
      <h2 className={styles.title}>
        {isEdit ? "스케줄 수정" : "새 스케줄"}
        {routeChannel != null ? ` · 채널 ${routeChannel}` : ""}
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

          {routeChannel == null ? (
            <div className={styles.field}>
              <span className={styles.label}>동작 유형</span>
              <select
                className={styles.select}
                value={actionType}
                onChange={(e) =>
                  setActionType(e.target.value as ScheduleActionType)
                }
              >
                <option value="channel">채널 제어</option>
                <option value="preset">프리셋 적용</option>
              </select>
              <p className={styles.hint}>
                프리셋 스케줄은 채널별 목록에 표시되지 않습니다.
              </p>
            </div>
          ) : null}

          {(routeChannel != null ? "channel" : actionType) === "channel" ? (
            <div className={styles.row}>
              <div className={styles.field}>
                <span className={styles.label}>채널</span>
                <select
                  className={styles.select}
                  value={channelNumber}
                  disabled={routeChannel != null}
                  onChange={(e) =>
                    setChannelNumber(Number(e.target.value) as StripChannelNumber)
                  }
                >
                  {[1, 2, 3, 4].map((num) => (
                    <option key={num} value={num}>
                      채널 {num}
                    </option>
                  ))}
                </select>
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
            </div>
          ) : (
            <div className={styles.field}>
              <span className={styles.label}>프리셋</span>
              <select
                className={styles.select}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              >
                <option value="">선택…</option>
                {(presetsQuery.data ?? []).map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>시간 (KST)</span>
            <TimeKstPicker12h value={timeKst} onChange={setTimeKst} />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>요일 — 달력에서 날짜를 눌러 선택</span>
            <ScheduleMonthCalendar
              year={calendarYear}
              month={calendarMonth}
              holidays={holidayDates(holidaysQuery.data)}
              selectedWeekdays={daysOfWeek}
              onToggleWeekday={toggleWeekday}
              onMonthChange={(y, m) => {
                setCalendarYear(y);
                setCalendarMonth(m);
              }}
            />
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
                    onChange={() => toggleWeekday(day)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className={styles.hint}>
              미리보기 기간: {previewFrom} ~ {previewTo}
            </p>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <span className={styles.label}>공휴일</span>
              <select
                className={styles.select}
                value={holidayMode}
                onChange={(e) =>
                  setHolidayMode(e.target.value as ScheduleHolidayMode)
                }
              >
                {(Object.keys(HOLIDAY_MODE_LABELS) as ScheduleHolidayMode[]).map(
                  (mode) => (
                    <option key={mode} value={mode}>
                      {HOLIDAY_MODE_LABELS[mode]}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={includeSubstitute}
              onChange={(e) => setIncludeSubstitute(e.target.checked)}
            />
            대체공휴일 포함
          </label>

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
              onClick={() => navigate(listPath)}
            >
              취소
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
