import { useCallback, useEffect, useRef, useState } from "react";

export interface UseCardSelectionOptions {
  /** 最多可選幾張。選滿即視為完成。 */
  max: number;
  /** 受控模式：由呼叫端持有已選集合。傳了它，內部就不再保留狀態。 */
  value?: number[];
  /** 已選集合變動時通知。受控與非受控模式都會呼叫。 */
  onChange?: (picked: number[]) => void;
  /** 選滿時呼叫。同一輪只會呼叫一次。 */
  onComplete?: (picked: number[]) => void;
  /** 是否允許再點一次取消選取。預設不允許——選牌是不可逆的儀式。 */
  allowDeselect?: boolean;
}

export interface CardSelection {
  /** 已選索引，依選取先後排列。 */
  picked: number[];
  /** 是否已選滿。 */
  done: boolean;
  /** 選取第 index 張。已選過、或已選滿時不生效。 */
  pick: (index: number) => void;
  /** 清空並允許重新觸發 onComplete。 */
  reset: () => void;
  /** 第 index 張的選取順序；未選則為 -1。 */
  orderOf: (index: number) => number;
}

/**
 * 計算下一份已選集合。純函式——沒有變化時回傳**原本那個陣列參考**，
 * 讓 React 能據此略過 re-render。
 */
export function applyPick(
  current: number[],
  index: number,
  max: number,
  allowDeselect: boolean,
): number[] {
  const at = current.indexOf(index);
  if (at >= 0) {
    // 重複選同一張不生效——這是 spec 明定的行為，不是實作細節。
    return allowDeselect ? [...current.slice(0, at), ...current.slice(at + 1)] : current;
  }
  if (current.length >= max) return current;
  return [...current, index];
}

/**
 * 選卡狀態機。與版面、與指標來源都無關——
 * 扇形、橫排、滑鼠、手勢，共用的都是這一份邏輯。
 */
export function useCardSelection(options: UseCardSelectionOptions): CardSelection {
  const { max, value, onChange, onComplete, allowDeselect = false } = options;

  const controlled = value !== undefined;
  const [internal, setInternal] = useState<number[]>([]);
  const picked = controlled ? value : internal;

  // onComplete 每次 render 都是新的函式參考，放進 effect 的依賴會每次都跑；
  // 用 ref 存最新的一份，effect 就只依賴「真正該觸發它的條件」。
  const onCompleteRef = useRef(onComplete);
  const onChangeRef = useRef(onChange);
  onCompleteRef.current = onComplete;
  onChangeRef.current = onChange;

  const pick = useCallback(
    (index: number) => {
      if (controlled) {
        const next = applyPick(value, index, max, allowDeselect);
        if (next !== value) onChangeRef.current?.(next);
        return;
      }
      // 非受控一定要用 functional updater：連續的點擊會落在同一個 React batch 裡，
      // 若讀外層的 picked，每次算出的都是同一份舊陣列，後面的點擊會蓋掉前面的。
      setInternal((current) => applyPick(current, index, max, allowDeselect));
    },
    [controlled, value, max, allowDeselect],
  );

  // 非受控模式的 onChange 通知。不在 updater 裡呼叫——updater 必須是純函式
  // （StrictMode 下會跑兩次）。首次 render 不通知。
  const previous = useRef<number[] | null>(null);
  useEffect(() => {
    if (controlled) return;
    if (previous.current !== null && previous.current !== internal) {
      onChangeRef.current?.(internal);
    }
    previous.current = internal;
  }, [controlled, internal]);

  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current && picked.length >= max) {
      fired.current = true;
      onCompleteRef.current?.(picked);
    }
  }, [picked, max]);

  const reset = useCallback(() => {
    fired.current = false;
    if (controlled) {
      onChangeRef.current?.([]);
    } else {
      setInternal([]);
    }
  }, [controlled]);

  const orderOf = useCallback((index: number) => picked.indexOf(index), [picked]);

  return { picked, done: picked.length >= max, pick, reset, orderOf };
}
