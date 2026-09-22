import type { PointerSignal } from "./types";

export interface ResolveOptions {
  /** 卡片總數。給了才能把索引夾在有效範圍內。 */
  count?: number;
  /**
   * 命中測試。預設用 `document.elementFromPoint`。
   *
   * 可注入是為了兩件事：測試不必起一個完整的 DOM，以及 SSR 期間不去碰 document。
   */
  hitTest?: (x: number, y: number) => Element | null;
  /** 限定只認這個容器裡的卡。多個選卡區同時存在時用得到。 */
  container?: Element | null;
}

function defaultHitTest(x: number, y: number): Element | null {
  if (typeof document === "undefined") return null;
  return document.elementFromPoint(x, y);
}

/**
 * 把指標訊號解析成「指著第幾張」。
 *
 * 座標型走 `document.elementFromPoint`，不自己算幾何。扇形的卡互相旋轉重疊，
 * 手刻命中判定要處理 transform 與堆疊順序，而瀏覽器的命中測試已經把這些算進去了——
 * 用它，手勢游標指到的卡就保證跟滑鼠指到的是同一張。
 */
export function resolveSignal(
  signal: PointerSignal | null,
  options: ResolveOptions = {},
): number | null {
  if (signal === null) return null;
  const { count, container } = options;

  if (signal.kind === "index") {
    if (!Number.isFinite(signal.value)) return null;
    const index = Math.round(signal.value);
    if (count === undefined) return index >= 0 ? index : null;
    if (count <= 0) return null;
    // 夾住而不是回傳 null：手舉到掃描範圍外時，目標應該停在頭尾那張，
    // 而不是整個失去目標——後者會讓使用者以為系統當掉了。
    return Math.min(Math.max(index, 0), count - 1);
  }

  const hitTest = options.hitTest ?? defaultHitTest;
  const element = hitTest(signal.x, signal.y);
  if (element === null) return null;

  const card = element.closest("[data-card-index]");
  if (card === null) return null;
  if (container != null && !container.contains(card)) return null;

  const raw = card.getAttribute("data-card-index");
  if (raw === null) return null;
  const index = Number(raw);
  if (!Number.isInteger(index) || index < 0) return null;
  if (count !== undefined && index >= count) return null;
  return index;
}
