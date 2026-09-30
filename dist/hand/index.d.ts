import { P as PointerInput } from '../types-Bw59kwoR.js';

/**
 * 手部關鍵點的數學。
 *
 * 這裡**沒有任何 IO**——不碰鏡頭、不碰 MediaPipe、不碰 DOM，純粹把 21 個點
 * 換算成「指著第幾張」與「有沒有握拳」。所以它全部可測，而鏡頭那一層
 * 只剩下「把每一幀餵進來」這件事。
 */
/** MediaPipe 的關鍵點。座標已正規化到 0..1（相對影像寬高）。 */
interface Landmark {
    readonly x: number;
    readonly y: number;
    readonly z?: number;
}
/** 手腕。 */
declare const WRIST = 0;
/** 中指根部。與手腕的距離拿來當手掌尺寸。 */
declare const MIDDLE_MCP = 9;
/** 食指、中指、無名指、小指的指尖。握拳判定用這四個。 */
declare const FINGERTIPS: readonly [8, 12, 16, 20];
/**
 * 手掌尺寸：手腕到中指根部的距離。
 *
 * 它同時是「這隻手離鏡頭多遠」的代理值——手在影像裡越小就是離得越遠。
 * 拿它當分母，所有比例判定就跟距離無關了。
 */
declare function palmSpan(hand: readonly Landmark[]): number | null;
/**
 * 握拳程度：四根指尖到手腕的平均距離 ÷ 手掌尺寸。
 *
 * 張開時指尖遠離手腕，比值大；握拳時指尖收回，比值小。中間有很寬的
 * 空白區間可以設閾值，而且全程只用 x/y——這正是選握拳而不選捏合的理由：
 * 捏合要量拇指與食指的距離，手側對鏡頭時兩者在投影上重疊，距離被低估而誤觸。
 */
declare function graspRatio(hand: readonly Landmark[]): number | null;
interface GraspThresholds {
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
declare const GRASP_DEFAULTS: GraspThresholds;
/**
 * 依上一幀的狀態決定這一幀是否算握緊。
 *
 * 偵測不到手時維持原狀而不是強制張開——手短暫離開畫面不該被當成「放開了」，
 * 否則一次閃失就會讓使用者連選兩張。
 */
declare function nextGrasp(previous: boolean, ratio: number | null, thresholds?: GraspThresholds): boolean;
/**
 * 掃描範圍：手實際掃過的水平區間。
 *
 * 用觀測到的範圍而不是一個猜出來的常數，是因為「手能掃多寬」同時取決於
 * 手臂長度、坐姿、離鏡頭多遠、鏡頭視野多廣——沒有一組固定值能涵蓋所有人。
 * 讓使用者掃到哪就把邊界推到哪，頭尾那張自然永遠碰得到。
 */
interface ScanRange {
    low: number;
    high: number;
}
/**
 * 範圍的最小寬度。
 *
 * 剛開始沒有觀測值，範圍若從零寬起算，手稍微動一下就會掃過全部的卡。
 * 先給一段合理的中央區間，再由實際動作往外撐開。
 */
declare const MIN_SCAN_WIDTH = 0.34;
declare function initialRange(center?: number, width?: number): ScanRange;
/**
 * 依觀測到的位置把範圍往外擴。
 *
 * **只擴不縮**：一輪選牌只有幾秒，範圍若會縮回去，使用者剛掃到的邊界
 * 會在下一秒失效，映射就開始漂。回傳原物件表示沒有變化。
 */
declare function widenRange(range: ScanRange, x: number): ScanRange;
/**
 * 邊界黏著的寬度，單位是「幾格」。
 *
 * 0.25 表示手要越過分界線再走 25% 的格寬，目標才換到相鄰那張——換句話說，
 * 離目前這張的中心超過 0.75 格才鬆手。
 *
 * 沒有它的話，手停在兩張卡的交界時，偵測本身的抖動（每幀幾個 pixel）就足以
 * 讓 round() 在兩個索引之間來回，目標高速跳動、根本按不準。這跟握拳判定
 * 用 close/open 兩個閾值是同一個理由，見 GRASP_DEFAULTS。
 */
declare const SCAN_STICKINESS = 0.25;
/**
 * 帶遲滯的索引取整。
 *
 * `position` 是連續的格座標（0 = 第一張，count-1 = 最後一張）。
 * 沒有前一個目標時直接四捨五入；有的話就黏住，除非離得夠遠。
 *
 * 越界後用 round 而不是 previous ± 1——手快速揮過去時位置可能一口氣跨好幾格，
 * 一次只走一格會讓目標追不上手。
 */
declare function stickyIndex(previous: number | null, position: number, count: number, stickiness?: number): number;
interface ScanOptions {
    /** 卡片總數。 */
    count: number;
    /** 鏡像。使用者看到的是自己的鏡像，手往右移索引也要往右。 */
    mirror?: boolean;
    /** 掃描範圍。由呼叫端持有並隨每一幀擴張。 */
    range: ScanRange;
    /**
     * 上一幀的目標。給了才有邊界黏著——不給就是每幀各自四捨五入。
     */
    previous?: number | null;
    /** 覆寫黏著寬度。 */
    stickiness?: number;
}
/**
 * 手掌水平位置 → 卡片索引。
 *
 * 只用 x。扇形本來就是沿一條弧線排的一維序列，用二維游標去指等於白白
 * 承受 y 軸的抖動；降成一維之後，整個垂直方向的誤差直接消失。
 *
 * 超出範圍時夾在頭尾那張——但配合 `widenRange`，超出這件事本身就會把
 * 邊界推出去，所以實際上很少走到夾住這條路。
 */
declare function scanIndex(hand: readonly Landmark[], options: ScanOptions): number | null;

type HandPointerStatus = 
/** 還沒啟動。 */
"idle"
/** 正在下載模型。 */
 | "loading"
/** 正在等使用者允許相機。 */
 | "requesting"
/** 運作中。 */
 | "running"
/** 使用者拒絕了相機。 */
 | "denied"
/** 裝置不支援，或模型載不起來。 */
 | "unsupported";
interface UseHandPointerOptions {
    count: number;
    /** 只有明確開啟才會載模型與要相機。 */
    enabled: boolean;
    /** 鏡像。使用者看到的是自己的鏡像，手往右移索引也要往右。 */
    mirror?: boolean;
    grasp?: GraspThresholds;
    wasmPath?: string;
    modelPath?: string;
}
interface HandPointer extends PointerInput {
    status: HandPointerStatus;
    /** 偵測不到手。用來提示使用者把手舉進畫面。 */
    handLost: boolean;
}
/**
 * 以鏡頭做手部追蹤的一維指標。
 *
 * 它只產出 `PointerInput`——也就是 `usePointerSelection` 已經在消費的那個介面。
 * latch、必須放開才能再選、邊界夾住、來源中斷不誤觸，全部在那一層做完了，
 * 所以這裡的責任只有一件事：**如實回報「指著第幾張」與「有沒有握拳」**。
 *
 * 推論全部在瀏覽器本機執行，影像不上傳也不留存。
 */
declare function useHandPointer(options: UseHandPointerOptions): HandPointer;

export { FINGERTIPS, GRASP_DEFAULTS, type GraspThresholds, type HandPointer, type HandPointerStatus, type Landmark, MIDDLE_MCP, MIN_SCAN_WIDTH, SCAN_STICKINESS, type ScanOptions, type ScanRange, type UseHandPointerOptions, WRIST, graspRatio, initialRange, nextGrasp, palmSpan, scanIndex, stickyIndex, useHandPointer, widenRange };
