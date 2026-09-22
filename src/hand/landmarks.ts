/**
 * 手部關鍵點的數學。
 *
 * 這裡**沒有任何 IO**——不碰鏡頭、不碰 MediaPipe、不碰 DOM，純粹把 21 個點
 * 換算成「指著第幾張」與「有沒有握拳」。所以它全部可測，而鏡頭那一層
 * 只剩下「把每一幀餵進來」這件事。
 */

/** MediaPipe 的關鍵點。座標已正規化到 0..1（相對影像寬高）。 */
export interface Landmark {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

/** 手腕。 */
export const WRIST = 0;
/** 中指根部。與手腕的距離拿來當手掌尺寸。 */
export const MIDDLE_MCP = 9;
/** 食指、中指、無名指、小指的指尖。握拳判定用這四個。 */
export const FINGERTIPS = [8, 12, 16, 20] as const;

function distance(a: Landmark, b: Landmark): number {
  // 只取 x/y。MediaPipe 的 z 是相對深度不是真實距離，精度差很多，
  // 把它算進來只會讓判定隨著手的朝向漂移。
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function at(hand: readonly Landmark[], index: number): Landmark | null {
  const point = hand[index];
  return point === undefined ? null : point;
}

/**
 * 手掌尺寸：手腕到中指根部的距離。
 *
 * 它同時是「這隻手離鏡頭多遠」的代理值——手在影像裡越小就是離得越遠。
 * 拿它當分母，所有比例判定就跟距離無關了。
 */
export function palmSpan(hand: readonly Landmark[]): number | null {
  const wrist = at(hand, WRIST);
  const mcp = at(hand, MIDDLE_MCP);
  if (wrist === null || mcp === null) return null;
  const span = distance(wrist, mcp);
  return span > 0 ? span : null;
}

/**
 * 握拳程度：四根指尖到手腕的平均距離 ÷ 手掌尺寸。
 *
 * 張開時指尖遠離手腕，比值大；握拳時指尖收回，比值小。中間有很寬的
 * 空白區間可以設閾值，而且全程只用 x/y——這正是選握拳而不選捏合的理由：
 * 捏合要量拇指與食指的距離，手側對鏡頭時兩者在投影上重疊，距離被低估而誤觸。
 */
export function graspRatio(hand: readonly Landmark[]): number | null {
  const wrist = at(hand, WRIST);
  const span = palmSpan(hand);
  if (wrist === null || span === null) return null;

  let total = 0;
  for (const tip of FINGERTIPS) {
    const point = at(hand, tip);
    if (point === null) return null;
    total += distance(wrist, point);
  }
  return total / FINGERTIPS.length / span;
}

export interface GraspThresholds {
  /** 低於它算握緊。 */
  close: number;
  /** 高於它才算重新張開。 */
  open: number;
}

/**
 * 預設閾值。實測後要調——這組是從「張開約 2.2、握拳約 1.1」推出的起點。
 *
 * close 與 open 之間刻意留一段空白（遲滯）：只用單一閾值的話，
 * 手停在邊界時會在握緊／張開之間高速跳動，變成連續誤選。
 */
export const GRASP_DEFAULTS: GraspThresholds = { close: 1.5, open: 1.8 };

/**
 * 依上一幀的狀態決定這一幀是否算握緊。
 *
 * 偵測不到手時維持原狀而不是強制張開——手短暫離開畫面不該被當成「放開了」，
 * 否則一次閃失就會讓使用者連選兩張。
 */
export function nextGrasp(
  previous: boolean,
  ratio: number | null,
  thresholds: GraspThresholds = GRASP_DEFAULTS,
): boolean {
  if (ratio === null) return previous;
  if (previous) return ratio <= thresholds.open;
  return ratio < thresholds.close;
}

export interface ScanOptions {
  /** 卡片總數。 */
  count: number;
  /** 有效區間佔影像寬度的比例。人很難把手舉到視野邊緣，用滿寬會導致兩端選不到。 */
  span?: number;
  /** 鏡像。使用者看到的是自己的鏡像，手往右移索引也要往右。 */
  mirror?: boolean;
  /**
   * 手掌尺寸的基準值。
   *
   * 手離鏡頭越遠，同樣幅度的手臂擺動在影像上移動得越少；用實際手掌尺寸與
   * 這個基準的比例去縮放有效區間，坐近坐遠就不必重新校準。
   */
  referencePalm?: number;
}

export const SCAN_DEFAULTS = {
  span: 0.65,
  mirror: true,
  referencePalm: 0.12,
  /** 依距離縮放後允許的區間範圍，避免極端值把映射壓成一個點或撐到滿寬。 */
  minSpan: 0.3,
  maxSpan: 0.95,
} as const;

/**
 * 手掌水平位置 → 卡片索引。
 *
 * 只用 x。扇形本來就是沿一條弧線排的一維序列，用二維游標去指等於白白
 * 承受 y 軸的抖動；降成一維之後，整個垂直方向的誤差直接消失。
 *
 * 超出區間時**夾在頭尾那張**而不是失去目標——後者會讓使用者以為系統當掉了。
 */
export function scanIndex(hand: readonly Landmark[], options: ScanOptions): number | null {
  const { count } = options;
  if (count <= 0) return null;

  const palm = at(hand, MIDDLE_MCP);
  if (palm === null) return null;

  const span = options.span ?? SCAN_DEFAULTS.span;
  const mirror = options.mirror ?? SCAN_DEFAULTS.mirror;
  const reference = options.referencePalm ?? SCAN_DEFAULTS.referencePalm;

  const size = palmSpan(hand);
  const scaled =
    size === null || reference <= 0
      ? span
      : Math.min(Math.max((span * size) / reference, SCAN_DEFAULTS.minSpan), SCAN_DEFAULTS.maxSpan);

  const x = mirror ? 1 - palm.x : palm.x;
  const low = 0.5 - scaled / 2;
  const t = Math.min(Math.max((x - low) / scaled, 0), 1);
  return Math.round(t * (count - 1));
}
