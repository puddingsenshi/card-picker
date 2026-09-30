import type { CSSProperties, ReactNode } from "react";
import { cardAngle, FAN_DEFAULTS, type FanGeometry, fanStyle } from "./geometry";

/**
 * 發牌的四段節奏：整疊浮現 → 停一拍 → 洗牌 → 依序攤開。
 *
 * 每一段都可以單獨調，也都可以設成 0 直接跳過那一段。
 */
export interface DealOptions {
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

export const DEAL_DEFAULTS = {
  enterMs: 420,
  holdMs: 200,
  shuffleMs: 1400,
  shuffleRounds: 2,
  shuffleSpread: "86%",
  spreadMs: 460,
  staggerMs: 45,
  from: "18%",
  deckFan: 0.06,
} as const;

/**
 * 發牌動畫的 CSS 變數。
 *
 * 總時長要算出來給 `cp-deal-gate`——牌還在飛的時候不能接受點擊，
 * 而 CSS 沒辦法自己知道最後一張什麼時候停。
 */
export function dealStyle(count: number, deal: boolean | DealOptions): Record<string, string> {
  if (deal === false) return {};
  const {
    enterMs,
    holdMs,
    shuffleMs,
    shuffleRounds,
    shuffleSpread,
    spreadMs,
    staggerMs,
    from,
    deckFan,
  } = deal === true ? DEAL_DEFAULTS : { ...DEAL_DEFAULTS, ...deal };

  // 洗牌用 iteration-count 重複，所以單次時長是總時長平均分配。
  // rounds 至少 1，否則單次時長會變成除以零。
  const rounds = Math.max(1, Math.round(shuffleRounds));
  const shuffle = Math.max(0, shuffleMs);
  const total = enterMs + holdMs + shuffle + staggerMs * Math.max(count - 1, 0) + spreadMs;

  return {
    "--cp-deal-enter": `${enterMs}ms`,
    "--cp-deal-hold": `${holdMs}ms`,
    "--cp-deal-shuffle": `${shuffle}ms`,
    "--cp-deal-shuffle-round": `${shuffle / rounds}ms`,
    "--cp-deal-rounds": String(rounds),
    "--cp-deal-shuffle-spread": shuffleSpread,
    "--cp-deal-spread": `${spreadMs}ms`,
    "--cp-deal-stagger": `${staggerMs}ms`,
    "--cp-deal-from": from,
    "--cp-deal-total": `${total}ms`,
    "--cp-deck-fan": String(deckFan),
  };
}

/**
 * 切牌時這張卡的角色與去處。
 *
 * ## 為什麼是「換層」而不是「位移」
 *
 * 讓人讀出「這副牌被洗過了」的視覺線索只有一個：**誰壓在誰上面換了**。
 * 卡片再怎麼左右移動，只要疊放順序沒變，看起來就只是一疊牌在抖——動得越多
 * 越像破圖。所以真正在動的是 `z-index`：上半疊被拿起來、移到旁邊的期間層級
 * 就換掉了，放回去時是從下面插進去，原本壓在最上面的那半疊變成在最底下。
 *
 * ## 為什麼每一輪結束要換回來
 *
 * 後面「依序攤開」需要層級嚴格依卡序，扇形才會一張整齊疊一張；層級被洗亂的話
 * 重疊順序會亂掉。所以換層只在切牌期間有效，牌堆合攏的那一刻換回原本的順序——
 * 牌背長得一樣，看不出來。
 *
 * 這也表示洗牌在資料上是「假的」，純粹是視覺。實際抽到哪張牌本來就由後端決定，
 * 這一層從頭到尾只知道「你選了第幾個位置」。
 */
export function cutVars(index: number, count: number): Record<string, number> {
  // 上半疊＝索引大的那半。z-index 依卡序遞增，所以索引大的本來就疊在上面。
  const half = Math.ceil(count / 2);
  const isTop = index >= half;

  return {
    // 橫向移開的倍數（乘上 shuffleSpread）。下半疊只稍微讓開，不是主角。
    "--cp-cut-x": isTop ? 1 : -0.12,
    // 只有被拿起來的那疊才抬高、才傾斜。
    "--cp-cut-top": isTop ? 1 : 0,
    // 切完之後的層級：上半疊整個沉到最底下，兩疊各自維持內部順序。
    "--cp-z-cut": isTop ? index - half : index + (count - half),
  };
}

/** 一張卡當下的狀態。傳給 `renderCard`，決定卡面怎麼畫。 */
export interface FanCardState {
  index: number;
  /** 是否已被選走。 */
  selected: boolean;
  /** 是否為指標當前指向的那張（滑鼠 hover 以外的指標來源用，例如手勢）。 */
  active: boolean;
  /** 選取順序；未選為 -1。呼叫端常用它決定要貼哪個位置標籤。 */
  order: number;
}

export interface FanLayoutProps {
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
export function FanLayout({
  count,
  renderCard,
  picked = [],
  activeIndex = null,
  onPick,
  disabled = false,
  cardLabel,
  geometry,
  deal = true,
  className,
}: FanLayoutProps) {
  const arc = geometry?.arc ?? FAN_DEFAULTS.arc;

  return (
    <div
      className={className === undefined ? "cp-fan" : `cp-fan ${className}`}
      data-has-selection={picked.length > 0}
      data-deal={deal !== false}
      style={{ ...fanStyle(geometry), ...dealStyle(count, deal) } as CSSProperties}
    >
      <div className="cp-fan-stage">
        {Array.from({ length: count }, (_, index) => {
          const order = picked.indexOf(index);
          const state: FanCardState = {
            index,
            order,
            selected: order >= 0,
            active: activeIndex === index,
          };

          return (
            <span
              key={index}
              className="cp-slot"
              data-selected={state.selected}
              style={{ "--cp-z": index, ...cutVars(index, count) } as CSSProperties}
            >
              <span
                className="cp-rotor"
                style={{ "--cp-angle": `${cardAngle(index, count, arc)}deg` } as CSSProperties}
              >
                <button
                  type="button"
                  className="cp-card"
                  // 指標層唯一的契約：座標型指標靠 elementFromPoint 反查這個屬性。
                  data-card-index={index}
                  data-active={state.active}
                  disabled={disabled}
                  aria-pressed={state.selected}
                  aria-label={cardLabel?.(state) ?? `Card ${index + 1}`}
                  onClick={() => onPick?.(index)}
                >
                  {renderCard(state)}
                </button>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
