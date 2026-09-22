import { useEffect, useRef, useState } from "react";
import { type ResolveOptions, resolveSignal } from "./resolve";
import type { PointerInput } from "./types";

export interface UsePointerSelectionOptions extends ResolveOptions {
  /** 指標來源的輸出。`null` 表示這個來源沒在運作。 */
  input: PointerInput | null;
  /** 確認選取時呼叫。 */
  onPick: (index: number) => void;
  /** 關掉時立刻清除目標，且不再觸發選取。例如已經選滿。 */
  enabled?: boolean;
}

/**
 * 把指標訊號接成選取行為。
 *
 * 這裡實作了兩件對所有輸入來源都成立的規則，所以手勢層只要如實回報「有沒有握拳」：
 *
 * 1. **Latch**：選取用的是「開始按住的那一刻」指著的那張，之後手怎麼飄都不改。
 *    握拳、按鍵、點擊——任何確認動作都會讓指標稍微位移，不鎖住就會選到隔壁。
 * 2. **必須放開才能再選**：按住不放不會連選。
 */
export function usePointerSelection({
  input,
  onPick,
  enabled = true,
  count,
  container,
  hitTest,
}: UsePointerSelectionOptions): { target: number | null } {
  const [target, setTarget] = useState<number | null>(null);

  // latch 要拿的是「commit 當下」的目標，而不是 effect 依賴閉包起來的舊值。
  const targetRef = useRef<number | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const wasCommitting = useRef(false);

  const signal = input?.signal ?? null;
  const committing = enabled && (input?.committing ?? false);

  useEffect(() => {
    if (!enabled) {
      targetRef.current = null;
      setTarget(null);
      return;
    }
    const next = resolveSignal(signal, { count, container, hitTest });
    targetRef.current = next;
    // 只在真的換卡時才 setState——手勢每秒送三十次訊號，其中絕大多數指的是同一張。
    setTarget((previous) => (previous === next ? previous : next));
  }, [enabled, signal, count, container, hitTest]);

  useEffect(() => {
    // 只認上升緣。這個 effect 排在解析 effect 之後，所以 targetRef 已是當下這一幀的值。
    if (committing && !wasCommitting.current) {
      const latched = targetRef.current;
      // 沒指到任何卡時按下去不算數——來源中斷絕不能變成誤選。
      if (latched !== null) onPickRef.current(latched);
    }
    wasCommitting.current = committing;
  }, [committing]);

  return { target };
}
