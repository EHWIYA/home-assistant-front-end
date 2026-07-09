import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type TouchEvent,
} from "react";

const PULL_THRESHOLD = 72;
const MAX_PULL = 128;
const PULL_RESISTANCE = 0.45;
const SNAP_MS = 220;

function applyPullResistance(distance: number): number {
  return Math.min(MAX_PULL, distance * PULL_RESISTANCE);
}

interface UsePullToRefreshOptions {
  scrollRef: RefObject<HTMLElement | null>;
  onRefresh: () => Promise<unknown>;
}

export function usePullToRefresh({
  scrollRef,
  onRefresh,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(0);
  /** scrollTop===0 터치 시작 — 아직 당김인지 스크롤인지 미확정 */
  const watchingPullRef = useRef(false);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshPromiseRef = useRef<Promise<unknown> | null>(null);

  const resetPull = useCallback(() => {
    watchingPullRef.current = false;
    pullingRef.current = false;
    pullDistanceRef.current = 0;
    setIsDragging(false);
    setPullDistance(0);
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshPromiseRef.current) {
      await refreshPromiseRef.current;
      return;
    }

    setIsRefreshing(true);
    pullDistanceRef.current = PULL_THRESHOLD;
    setPullDistance(PULL_THRESHOLD);

    const refreshPromise = onRefresh().finally(() => {
      refreshPromiseRef.current = null;
    });
    refreshPromiseRef.current = refreshPromise;

    try {
      await refreshPromise;
    } finally {
      setIsRefreshing(false);
      resetPull();
    }
  }, [onRefresh, resetPull]);

  const onTouchStart = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      if (isRefreshing || event.touches.length !== 1) {
        return;
      }

      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      if (scrollTop > 0) {
        watchingPullRef.current = false;
        return;
      }

      startYRef.current = event.touches[0]?.clientY ?? 0;
      watchingPullRef.current = true;
    },
    [isRefreshing, scrollRef],
  );

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      if ((!watchingPullRef.current && !pullingRef.current) || isRefreshing) {
        return;
      }

      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      if (scrollTop > 0) {
        resetPull();
        return;
      }

      const currentY = event.touches[0]?.clientY ?? startYRef.current;
      const delta = currentY - startYRef.current;
      if (delta <= 0) {
        if (pullingRef.current) {
          resetPull();
        } else {
          watchingPullRef.current = false;
        }
        return;
      }

      watchingPullRef.current = false;
      pullingRef.current = true;
      setIsDragging(true);
      event.preventDefault();
      const nextDistance = applyPullResistance(delta);
      pullDistanceRef.current = nextDistance;
      setPullDistance(nextDistance);
    },
    [isRefreshing, resetPull, scrollRef],
  );

  const onTouchEnd = useCallback(() => {
    if (!watchingPullRef.current && !pullingRef.current) {
      return;
    }
    if (isRefreshing) {
      return;
    }
    if (!pullingRef.current) {
      watchingPullRef.current = false;
      return;
    }

    if (pullDistanceRef.current >= PULL_THRESHOLD) {
      void runRefresh();
      return;
    }

    resetPull();
  }, [isRefreshing, resetPull, runRefresh]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const blockOverscroll = (event: Event) => {
      if (!pullingRef.current || isRefreshing || pullDistanceRef.current <= 0) {
        return;
      }
      if ((scrollRef.current?.scrollTop ?? 0) <= 0) {
        event.preventDefault();
      }
    };

    node.addEventListener("touchmove", blockOverscroll, { passive: false });
    return () => {
      node.removeEventListener("touchmove", blockOverscroll);
    };
  }, [isRefreshing, scrollRef]);

  const displayDistance = isRefreshing ? PULL_THRESHOLD : pullDistance;
  const isReady = pullDistance >= PULL_THRESHOLD;

  const contentStyle: CSSProperties = {
    transform:
      displayDistance > 0 ? `translateY(${displayDistance}px)` : undefined,
    transition: isDragging ? "none" : `transform ${SNAP_MS}ms ease`,
  };

  return {
    pullDistance: displayDistance,
    isRefreshing,
    isReady,
    contentStyle,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
  };
}
