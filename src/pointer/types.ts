/**
 * 指標訊號：某個輸入來源說「現在指著這裡」。
 *
 * 兩種型別不是為了通用而通用——它們對應兩種本質不同的輸入：
 *
 * - `point` 是**二維**的：滑鼠、觸控、以及把手當游標用的 2D 手勢。
 *   指到哪張卡要問瀏覽器（見 `resolveSignal`）。
 * - `index` 是**一維**的：手掌水平掃描這類沿著序列滑動的輸入。
 *   它本身就已經是索引了。
 *
 * 曾經考慮只留 `point`、把一維掃描換算成座標再反查回來——否決：
 * 那是把已經精確的索引降格成座標再猜一次，白白引入誤差。
 */
export type PointerSignal =
  | { kind: "point"; x: number; y: number }
  | { kind: "index"; value: number };

/** 指標來源的完整輸出。 */
export interface PointerInput {
  /** 目前指向哪裡；來源中斷（手離開畫面、滑鼠移出）時為 null。 */
  signal: PointerSignal | null;
  /**
   * 是否正在「按住」——握拳、按住按鍵、按住滑鼠。
   *
   * 選取發生在它由 false 變 true 的那一刻，且必須放開才能再選下一張。
   * 這個三態循環天生自帶冷卻，不需要額外的防連選時間鎖。
   */
  committing: boolean;
}
