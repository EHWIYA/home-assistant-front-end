import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { paths } from "@/routes/paths";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  ScheduleActionType,
  ScheduleCreateBody,
  ScheduleHolidayMode,
  StripChannelNumber,
} from "@/api/types";
import {
  useCreateSchedule,
  usePatchSchedule,
  useSchedules,
  useStripPresets,
} from "@/hooks/useSchedules";
import { useMutationErrorToast } from "@/hooks/useMutationErrorToast";
import { useQueryErrorToast } from "@/hooks/useQueryErrorToast";
import {
  DEFAULT_SCHEDULE_FORM,
  isValidTimeKst,
  parseChannelRouteParam,
} from "@/utils/schedule";
import {
  TOAST_DEVICE,
  TOAST_GUIDE,
  TOAST_RESOURCE,
} from "@/utils/toastMessages";
import { HolidayOptions } from "./components/HolidayOptions";
import { OnOffSegment } from "./components/OnOffSegment";
import { TimeKstPicker12h } from "./components/TimeKstPicker12h";
import { WeekdayPicker } from "./components/WeekdayPicker";
import shared from "@/components/status/statusPage.module.css";
import styles from "./ScheduleFormPage.module.css";

type ValidationError = {
  field: "name" | "time" | "days" | "preset" | "action";
  message: string;
};

export function ScheduleFormPage() {
  const { n, id } = useParams<{ n?: string; id?: string }>();
  const routeChannel = parseChannelRouteParam(n);
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const schedulesQuery = useSchedules(routeChannel ?? undefined);
  const presetsQuery = useStripPresets();
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
  const [validationError, setValidationError] = useState<ValidationError | null>(null);

  const editSchedule = useMemo(() => {
    const list = schedulesQuery.data;
    if (!Array.isArray(list) || !id) return undefined;
    return list.find((s) => s.id === id);
  }, [schedulesQuery.data, id]);

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

  function buildBody(): ScheduleCreateBody | null {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError({ field: "name", message: "이름을 입력하세요." });
      return null;
    }
    if (!isValidTimeKst(timeKst)) {
      setValidationError({ field: "time", message: "시간 형식이 올바르지 않습니다." });
      return null;
    }
    if (daysOfWeek.length === 0) {
      setValidationError({ field: "days", message: "요일을 하나 이상 선택하세요." });
      return null;
    }
    if (actionType === "preset" && !presetName.trim()) {
      setValidationError({ field: "preset", message: "프리셋을 선택하세요." });
      return null;
    }
    if (routeChannel != null && actionType === "preset") {
      setValidationError({
        field: "action",
        message: "채널 스케줄 화면에서는 채널 제어만 등록할 수 있습니다.",
      });
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
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="schedule-name">
                이름
              </label>
              <label className={styles.enabledToggle}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                활성화
              </label>
            </div>
            <input
              id="schedule-name"
              className={styles.input}
              value={name}
              aria-invalid={validationError?.field === "name"}
              aria-describedby={
                validationError?.field === "name" ? "schedule-name-error" : undefined
              }
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 아침 콘센트"
              maxLength={80}
            />
            {validationError?.field === "name" ? (
              <p id="schedule-name-error" className={styles.errorDetail} role="alert">
                {validationError.message}
              </p>
            ) : null}
          </div>

          {routeChannel == null ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="schedule-action-type">
                동작 유형
              </label>
              <select
                id="schedule-action-type"
                className={styles.select}
                value={actionType}
                aria-invalid={validationError?.field === "action"}
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
              {validationError?.field === "action" ? (
                <p className={styles.errorDetail} role="alert">
                  {validationError.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {(routeChannel != null ? "channel" : actionType) === "channel" ? (
            routeChannel != null ? (
              <div className={styles.field}>
                <span className={styles.label}>동작</span>
                <OnOffSegment value={channelOn} onChange={setChannelOn} />
              </div>
            ) : (
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="schedule-channel">
                    채널
                  </label>
                  <select
                    id="schedule-channel"
                    className={styles.select}
                    value={channelNumber}
                    onChange={(e) =>
                      setChannelNumber(
                        Number(e.target.value) as StripChannelNumber,
                      )
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
                  <OnOffSegment value={channelOn} onChange={setChannelOn} />
                </div>
              </div>
            )
          ) : (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="schedule-preset">
                프리셋
              </label>
              <select
                id="schedule-preset"
                className={styles.select}
                value={presetName}
                aria-invalid={validationError?.field === "preset"}
                aria-describedby={
                  validationError?.field === "preset" ? "schedule-preset-error" : undefined
                }
                onChange={(e) => setPresetName(e.target.value)}
              >
                <option value="">선택…</option>
                {(presetsQuery.data ?? []).map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
              {validationError?.field === "preset" ? (
                <p id="schedule-preset-error" className={styles.errorDetail} role="alert">
                  {validationError.message}
                </p>
              ) : null}
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>시간</span>
            <TimeKstPicker12h value={timeKst} onChange={setTimeKst} />
            {validationError?.field === "time" ? (
              <p className={styles.errorDetail} role="alert">
                {validationError.message}
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>반복 요일</span>
            <WeekdayPicker value={daysOfWeek} onChange={setDaysOfWeek} />
            {validationError?.field === "days" ? (
              <p className={styles.errorDetail} role="alert">
                {validationError.message}
              </p>
            ) : null}
          </div>

          <HolidayOptions
            holidayMode={holidayMode}
            includeSubstitute={includeSubstitute}
            onHolidayModeChange={setHolidayMode}
            onIncludeSubstituteChange={setIncludeSubstitute}
          />

          {mutationError ? (
            <p className={styles.errorDetail} role="alert">
              저장하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도하세요.
            </p>
          ) : null}

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
