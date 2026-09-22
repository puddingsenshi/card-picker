/**
 * 扇形幾何。
 *
 * 這裡不存在任何量測出來的魔術數字——所有尺寸都從「卡片寬度」與「長寬比」推導。
 * 原本的實作把 `h-[19rem]`、`scale-[0.48]` 這類量測值寫死在 class 裡，
 * 卡片尺寸一改就全數失效；共用元件的卡片尺寸由呼叫端決定，非推導不可。
 *
 * ## 幾何模型
 *
 * 每張卡以「卡面下方很遠處」的一個樞紐為圓心旋轉攤開（像實體牌以手腕為圓心）。
 * 樞紐位置用 `pivot` 表示，單位是卡高的倍數，從卡片**頂端**往下量：
 *
 * ```
 *        ┌─────┐  ← 卡頂，距樞紐 pivot × h
 *        │     │
 *        │  卡  │  h = w × ratio
 *        │     │
 *        └─────┘  ← 卡底，距樞紐 (pivot - 1) × h
 *           ⋮
 *           ●     ← 樞紐 (transform-origin: 50% pivot×100%)
 * ```
 *
 * ## 外接尺寸的推導
 *
 * 令 h 為卡高、w 為卡寬、P 為 pivot、A 為半張角（arc）。以樞紐為原點、向上為正：
 *
 * - 最高點：正中央那張未旋轉，其卡頂在 `P·h`。
 * - 最低點：兩端那張旋轉 A 之後的下緣角落，垂直分量為
 *   `(P-1)·h·cos(A) - (w/2)·sin(A)`。
 * - 最寬點：兩端那張的上緣外角，水平分量為 `(w/2)·cos(A) + P·h·sin(A)`。
 *
 * 於是（都換算成「卡寬的幾倍」）：
 *
 * ```
 * 高 / w = ratio × (P - (P-1)·cos A) + 0.5 × sin A
 * 寬 / w = 2 × (0.5 × cos A + ratio × P × sin A)
 * ```
 *
 * 代入目前的預設值（ratio = 19/11、P = 2.6、A = 34°）得高 ≈ 2.48w、寬 ≈ 5.85w。
 * 對照舊實作的量測註解「扇形高約卡高的 1.46 倍」→ 1.46 × 1.727w ≈ 2.52w，
 * 以及「扇形寬約卡寬的 6 倍」，兩者都吻合——公式是對的，只是不再需要用尺去量。
 *
 * ## 為什麼用 CSS 而不是在 JS 算出像素
 *
 * 這些值最後都變成 CSS 變數，由瀏覽器用 `cos()` / `sin()` 即時求值。
 * 好處是卡寬可以寫成 `min(理想寬, 容器寬 / 寬倍數)`——扇形**永遠**剛好塞滿容器寬度，
 * 不必再像舊實作那樣在手機上套一個 `scale(0.48)` 硬縮，也就不必為了 transform
 * 不觸發 reflow 而在外層補一層佔位高度。
 */

/** 預設值。與 MT-103 的原始外觀一致。 */
export const FAN_DEFAULTS = {
  /** 扇形左右各張開的角度。 */
  arc: 34,
  /**
   * 樞紐位置，單位為卡高的倍數（從卡頂往下量）。
   *
   * 值越大＝虛擬半徑越長＝牌鋪得越開，但兩端的牌垂得越低、容器也要更高。
   * 2.6 是「看得出是扇形、又塞得進一般視窗高度」的折衷。
   */
  pivot: 2.6,
  /** 卡片長寬比（高 ÷ 寬）。預設是塔羅牌常見的 11:19。 */
  ratio: 19 / 11,
  /** 卡片理想寬度。容器不夠寬時會等比縮小，不會溢出。 */
  maxCardWidth: "8rem",
  /**
   * 卡片被指向或選中時往上推出的距離。
   *
   * 也是容器頂端要預留的餘裕——推出的那張不該被容器裁掉。
   */
  lift: "2rem",
} as const;

export interface FanGeometry {
  arc: number;
  pivot: number;
  ratio: number;
  maxCardWidth: string;
  lift: string;
}

/**
 * 把幾何參數轉成一組 CSS 變數。
 *
 * 回傳的物件直接展開到容器的 `style` 上；實際的三角函數由 CSS 求值，
 * 所以卡寬隨容器變化時，高度與角度會自己跟上，不需要 ResizeObserver。
 */
export function fanStyle(geometry: Partial<FanGeometry> = {}): Record<string, string> {
  const { arc, pivot, ratio, maxCardWidth, lift } = { ...FAN_DEFAULTS, ...geometry };

  const arcDeg = `${arc}deg`;
  // 「扇形寬是卡寬的幾倍」與「扇形高是卡寬的幾倍」——推導見本檔開頭。
  const widthPerCard = `(2 * (0.5 * cos(${arcDeg}) + ${ratio} * ${pivot} * sin(${arcDeg})))`;
  const heightPerCard = `(${ratio} * (${pivot} - ${pivot - 1} * cos(${arcDeg})) + 0.5 * sin(${arcDeg}))`;

  return {
    "--cp-arc": arcDeg,
    "--cp-pivot": `${pivot * 100}%`,
    "--cp-lift": lift,
    // 卡寬取「理想寬」與「容器寬 ÷ 寬倍數」的較小者：扇形永遠剛好合身。
    // 100cqw 需要容器自己宣告 container-type: inline-size（見 fan-layout.css）。
    "--cp-card-w": `min(${maxCardWidth}, 100cqw / ${widthPerCard})`,
    "--cp-card-h": `calc(var(--cp-card-w) * ${ratio})`,
    "--cp-fan-h": `calc(var(--cp-card-w) * ${heightPerCard} + var(--cp-lift))`,
  };
}

/**
 * 第 index 張在扇形中的角度。
 *
 * 等距分佈在 `[-arc, +arc]`，所以索引順序與視覺上的左右順序嚴格一致——
 * 一維指標（手勢掃描）能直接用索引定位，靠的就是這個性質。
 */
export function cardAngle(index: number, count: number, arc: number = FAN_DEFAULTS.arc): number {
  if (count <= 1) return 0;
  return -arc + (index * (arc * 2)) / (count - 1);
}
