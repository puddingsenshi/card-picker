import type { CSSProperties, ReactNode } from "react";
import { cardAngle, FAN_DEFAULTS, type FanGeometry, fanStyle } from "./geometry";

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
  className,
}: FanLayoutProps) {
  const arc = geometry?.arc ?? FAN_DEFAULTS.arc;

  return (
    <div
      className={className === undefined ? "cp-fan" : `cp-fan ${className}`}
      style={fanStyle(geometry) as CSSProperties}
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
              style={{ "--cp-z": index } as CSSProperties}
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
