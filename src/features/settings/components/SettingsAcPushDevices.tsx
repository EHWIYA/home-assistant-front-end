import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/toast/ToastProvider";
import {
  deleteRemotePushToken,
  fetchPushStatus,
  listPushTokens,
  sendTestPush,
  type PushStatusResponse,
  type PushTokenRecord,
} from "@/push/api";
import { readAcPushToken } from "@/push/storage";
import { formatAcPushAlertTime } from "@/push/alertFormat";
import styles from "./SettingsAcPushDevices.module.css";

interface SettingsAcPushDevicesProps {
  enabled: boolean;
  onReregister: () => Promise<void>;
  reregisterBusy: boolean;
}

export function SettingsAcPushDevices({
  enabled,
  onReregister,
  reregisterBusy,
}: SettingsAcPushDevicesProps) {
  const { showToast } = useToast();
  const [tokens, setTokens] = useState<PushTokenRecord[] | null>(null);
  const [status, setStatus] = useState<PushStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const localToken = readAcPushToken();

  const reload = useCallback(async () => {
    setLoading(true);
    const [remoteTokens, pushStatus] = await Promise.all([
      listPushTokens(),
      fetchPushStatus(),
    ]);
    setTokens(remoteTokens);
    setStatus(pushStatus);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      void reload();
    }
  }, [enabled, reload]);

  const handleDeleteToken = async (token: string) => {
    const result = await deleteRemotePushToken(token);
    if (result.ok) {
      showToast("기기 등록을 해제했습니다.", { variant: "info", category: "sync" });
      await reload();
    } else {
      showToast(result.error, { variant: "warn", category: "sync" });
    }
  };

  const handleTestPush = async () => {
    setTestBusy(true);
    const result = await sendTestPush();
    setTestBusy(false);
    if (result.ok) {
      showToast("테스트 푸시를 요청했습니다. OS 알림을 확인해 주세요.", {
        variant: "info",
        category: "sync",
      });
    } else {
      showToast(result.error, { variant: "warn", category: "sync" });
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.title}>등록 · 운영</h3>

      {loading ? <p className={styles.hint}>등록 정보를 불러오는 중…</p> : null}

      {status?.nextAllowedAt ? (
        <p className={styles.statusLine}>
          다음 발송 가능: {formatAcPushAlertTime(status.nextAllowedAt)}
        </p>
      ) : status?.lastSentAt ? (
        <p className={styles.statusLine}>
          마지막 발송: {formatAcPushAlertTime(status.lastSentAt)}
        </p>
      ) : status?.enabled === false ? (
        <p className={styles.statusLine}>NAS 발송이 비활성화되어 있습니다.</p>
      ) : status?.ok ? (
        <p className={styles.statusLine}>운영 발송 대기 중 (12시간에 한 번)</p>
      ) : null}

      <div className={styles.actions}>
        <Button variant="secondary" disabled={reregisterBusy} onClick={() => void onReregister()}>
          {reregisterBusy ? "재등록 중…" : "다시 등록"}
        </Button>
        <Button variant="secondary" disabled={testBusy} onClick={() => void handleTestPush()}>
          {testBusy ? "요청 중…" : "테스트 푸시"}
        </Button>
      </div>

      {tokens === null ? (
        <p className={styles.hint}>등록 기기 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : tokens.length === 0 ? (
        <p className={styles.hint}>
          NAS에 등록된 기기가 없습니다. 위 <strong>다시 등록</strong>으로 토큰을 갱신한 뒤 테스트
          푸시를 시도해 주세요.
        </p>
      ) : localToken && !tokens.some((item) => item.token === localToken) ? (
        <p className={styles.hintWarn}>
          이 기기 토큰이 NAS에 없습니다. <strong>다시 등록</strong>을 눌러 주세요.
        </p>
      ) : null}

      {tokens && tokens.length > 0 ? (
        <ul className={styles.list}>
          {tokens.map((item) => {
            const isCurrent = item.token === localToken;
            return (
              <li key={item.token} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.itemLabel}>
                    {item.label}
                    {isCurrent ? " (이 기기)" : ""}
                  </span>
                  {item.registeredAt ? (
                    <span className={styles.itemMeta}>
                      등록 {formatAcPushAlertTime(item.registeredAt)}
                    </span>
                  ) : null}
                </div>
                {!isCurrent ? (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => void handleDeleteToken(item.token)}
                  >
                    해제
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
