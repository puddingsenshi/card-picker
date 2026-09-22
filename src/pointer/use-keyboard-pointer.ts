import { useEffect, useState } from "react";
import type { PointerInput } from "./types";

export interface UseKeyboardPointerOptions {
  count: number;
  enabled?: boolean;
  /** 起點。預設正中央——扇形的中間那張是最自然的起手位置。 */
  initialIndex?: number;
}

const MOVE_KEYS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
};
const COMMIT_KEYS = new Set(["Enter", " ", "Spacebar"]);

/**
 * 用鍵盤模擬一維指標。
 *
 * 它本身是個能用的鍵盤操作方式，但真正的用途是**替手勢層打樣**：
 * 左右鍵等於手掌左右移動、按住 Enter 等於握拳、放開等於張開手。
 * 有了它，選取流程（latch、必須放開才能再選、來源中斷）可以在完全不碰鏡頭的
 * 情況下驗證完，之後接上 MediaPipe 時就只剩「landmark 換算成索引」這一件事。
 */
export function useKeyboardPointer({
  count,
  enabled = true,
  initialIndex,
}: UseKeyboardPointerOptions): PointerInput {
  const [index, setIndex] = useState(() => initialIndex ?? Math.floor((count - 1) / 2));
  const [committing, setCommitting] = useState(false);
  // 沒按過方向鍵之前不送訊號——否則一進畫面就有一張卡自己浮起來，
  // 對只想用滑鼠的人是莫名其妙的干擾。
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setEngaged(false);
      setCommitting(false);
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      const step = MOVE_KEYS[event.key];
      if (step !== undefined) {
        event.preventDefault();
        setEngaged(true);
        setIndex((current) => Math.min(Math.max(current + step, 0), count - 1));
        return;
      }

      if (!COMMIT_KEYS.has(event.key)) return;
      // 焦點落在某張卡上時放行給瀏覽器——button 的原生 Enter 會自己觸發 click，
      // 這裡再選一次就會變成一次按鍵選走兩張。
      if (document.activeElement?.closest("[data-card-index]") != null) return;
      if (!engaged) return;
      event.preventDefault();
      setCommitting(true);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (COMMIT_KEYS.has(event.key)) setCommitting(false);
    }

    // 離開頁面時鍵盤的 keyup 收不到，會卡在「一直按著」的狀態。
    function onBlur() {
      setCommitting(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, count, engaged]);

  return {
    signal: enabled && engaged ? { kind: "index", value: index } : null,
    committing,
  };
}
