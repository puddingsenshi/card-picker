import * as react from 'react';
import { ReactNode } from 'react';

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
declare const FAN_DEFAULTS: {
    /** 扇形左右各張開的角度。 */
    readonly arc: 34;
    /**
     * 樞紐位置，單位為卡高的倍數（從卡頂往下量）。
     *
     * 值越大＝虛擬半徑越長＝牌鋪得越開，但兩端的牌垂得越低、容器也要更高。
     * 2.6 是「看得出是扇形、又塞得進一般視窗高度」的折衷。
     *
     * 它會換算成固定長度而不是百分比——見 `fanStyle` 裡的說明。
     */
    readonly pivot: 2.6;
    /** 卡片長寬比（高 ÷ 寬）。預設是塔羅牌常見的 11:19。 */
    readonly ratio: number;
    /** 卡片理想寬度。容器不夠寬時會等比縮小，不會溢出。 */
    readonly maxCardWidth: "8rem";
    /** 卡片被指向時往上推出的距離。 */
    readonly lift: "2rem";
    /**
     * 選中的卡停留的位置。**預設與 `lift` 相同——就是滑鼠滑過時的那個高度。**
     *
     * 選走一張，它就停在剛才被指到的位置不再退回去，其餘什麼都不變：
     * 角度不變、圖層不變、鄰卡不淡化。它仍然是牌組裡的第 n 張，該被鄰卡壓住
     * 就被壓住——選中與未選中的差別交給卡面自己表現（呼叫端畫的框、底色之類）。
     *
     * 別為了「讓人看出選了哪張」而把這個值調大：推得越遠越像飛離牌組。
     * 容器頂端會自動預留這段距離（見 `fanStyle`），真要調大也不會被裁掉。
     */
    readonly selectedLift: "var(--cp-lift)";
    /**
     * 有選取時，未選卡的不透明度。**預設關閉（1）。**
     *
     * 選牌通常要選好幾張，淡化會讓還沒選的那些變得難挑——尤其深色底上，
     * 壓一點點就幾乎看不見了。預設維持原樣，需要的人再自己調低。
     */
    readonly dimUnselected: 1;
};
interface FanGeometry {
    arc: number;
    pivot: number;
    ratio: number;
    maxCardWidth: string;
    lift: string;
    /** CSS 長度，可引用 `var(--cp-lift)`。 */
    selectedLift: string;
    dimUnselected: number;
}
/**
 * 把幾何參數轉成一組 CSS 變數。
 *
 * 回傳的物件直接展開到容器的 `style` 上；實際的三角函數由 CSS 求值，
 * 所以卡寬隨容器變化時，高度與角度會自己跟上，不需要 ResizeObserver。
 */
declare function fanStyle(geometry?: Partial<FanGeometry>): Record<string, string>;
/**
 * 第 index 張在扇形中的角度。
 *
 * 等距分佈在 `[-arc, +arc]`，所以索引順序與視覺上的左右順序嚴格一致——
 * 一維指標（手勢掃描）能直接用索引定位，靠的就是這個性質。
 */
declare function cardAngle(index: number, count: number, arc?: number): number;

/**
 * 發牌的四段節奏：整疊浮現 → 停一拍 → 洗牌 → 依序攤開。
 *
 * 每一段都可以單獨調，也都可以設成 0 直接跳過那一段。
 */
interface DealOptions {
    /** 整疊牌浮現的時間。 */
    enterMs?: number;
    /** 牌堆浮現後停住不動的時間。讓人先看清楚「這是一整副牌」再開始洗。 */
    holdMs?: number;
    /** 洗牌的總時間。設 0 等於不洗，直接從牌堆攤開。 */
    shuffleMs?: number;
    /** 切幾次牌。總時間會平均分給每一次。 */
    shuffleRounds?: number;
    /** 被拿起來那一疊橫向移開的距離。CSS 長度，相對卡寬。 */
    shuffleSpread?: string;
    /** 每張攤開的時間。 */
    spreadMs?: number;
    /** 相鄰兩張攤開的間隔。決定「一張張展開」的節奏。 */
    staggerMs?: number;
    /** 牌堆從多遠的地方浮上來。CSS 長度，相對卡高。 */
    from?: string;
    /**
     * 牌堆靜止時預先攤開的比例（最終角度的幾分之幾）。
     *
     * 沒有它，攤開前每張卡的角度都是 0、完全重疊，一整副牌看起來只有一張。
     * 給一點點角度，邊緣就露出來了，才像手上握著的一疊牌。
     */
    deckFan?: number;
}
declare const DEAL_DEFAULTS: {
    readonly enterMs: 420;
    readonly holdMs: 200;
    readonly shuffleMs: 1400;
    readonly shuffleRounds: 2;
    readonly shuffleSpread: "86%";
    readonly spreadMs: 460;
    readonly staggerMs: 45;
    readonly from: "18%";
    readonly deckFan: 0.06;
};
/**
 * 發牌動畫的 CSS 變數。
 *
 * 總時長要算出來給 `cp-deal-gate`——牌還在飛的時候不能接受點擊，
 * 而 CSS 沒辦法自己知道最後一張什麼時候停。
 */
declare function dealStyle(count: number, deal: boolean | DealOptions): Record<string, string>;
/** 一張卡當下的狀態。傳給 `renderCard`，決定卡面怎麼畫。 */
interface FanCardState {
    index: number;
    /** 是否已被選走。 */
    selected: boolean;
    /** 是否為指標當前指向的那張（滑鼠 hover 以外的指標來源用，例如手勢）。 */
    active: boolean;
    /** 選取順序；未選為 -1。呼叫端常用它決定要貼哪個位置標籤。 */
    order: number;
}
interface FanLayoutProps {
    /** 攤開幾張。與實際要選幾張無關，純粹是排面。 */
    count: number;
    /** 卡面由呼叫端畫。元件本身不渲染任何卡片樣式。 */
    renderCard: (state: FanCardState) => ReactNode;
    /** 已選索引，依選取先後排列。 */
    picked?: number[];
    /**
     * 指標當前指向的索引。
     *
     * 滑鼠不需要它（CSS 的 :hover 就夠了）；它是給座標以外的指標來源用的，
     * 例如手勢的一維掃描。
     */
    activeIndex?: number | null;
    onPick?: (index: number) => void;
    /** 停用全部互動，例如已經選滿。 */
    disabled?: boolean;
    /** 每張卡的無障礙標籤。不給則退回 `Card N`。 */
    cardLabel?: (state: FanCardState) => string;
    geometry?: Partial<FanGeometry>;
    /**
     * 發牌動畫：一疊牌浮現，再依序攤成扇形。
     *
     * `false` 關掉，卡片直接出現在最終位置。
     */
    deal?: boolean | DealOptions;
    className?: string;
}
/**
 * 扇形排列。
 *
 * 只決定「怎麼排、指到哪張、選了哪些」，不知道卡片是什麼、也不知道選完要做什麼。
 * 樣式在 `card-picker/style.css`，呼叫端需自行 import 一次。
 */
declare function FanLayout({ count, renderCard, picked, activeIndex, onPick, disabled, cardLabel, geometry, deal, className, }: FanLayoutProps): react.JSX.Element;

interface UseCardSelectionOptions {
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
interface CardSelection {
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
 * 選卡狀態機。與版面、與指標來源都無關——
 * 扇形、橫排、滑鼠、手勢，共用的都是這一份邏輯。
 */
declare function useCardSelection(options: UseCardSelectionOptions): CardSelection;

export { type CardSelection, DEAL_DEFAULTS, type DealOptions, FAN_DEFAULTS, type FanCardState, type FanGeometry, FanLayout, type FanLayoutProps, type UseCardSelectionOptions, cardAngle, dealStyle, fanStyle, useCardSelection };
