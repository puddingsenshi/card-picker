import { jsx } from 'react/jsx-runtime';
import { useState, useRef, useCallback, useEffect } from 'react';

// src/geometry.ts
var FAN_DEFAULTS = {
  /** 扇形左右各張開的角度。 */
  arc: 34,
  /**
   * 樞紐位置，單位為卡高的倍數（從卡頂往下量）。
   *
   * 值越大＝虛擬半徑越長＝牌鋪得越開，但兩端的牌垂得越低、容器也要更高。
   * 2.6 是「看得出是扇形、又塞得進一般視窗高度」的折衷。
   *
   * 它會換算成固定長度而不是百分比——見 `fanStyle` 裡的說明。
   */
  pivot: 2.6,
  /** 卡片長寬比（高 ÷ 寬）。預設是塔羅牌常見的 11:19。 */
  ratio: 19 / 11,
  /** 卡片理想寬度。容器不夠寬時會等比縮小，不會溢出。 */
  maxCardWidth: "8rem",
  /** 卡片被指向時往上推出的距離。 */
  lift: "2rem",
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
  selectedLift: "var(--cp-lift)",
  /**
   * 有選取時，未選卡的不透明度。**預設關閉（1）。**
   *
   * 選牌通常要選好幾張，淡化會讓還沒選的那些變得難挑——尤其深色底上，
   * 壓一點點就幾乎看不見了。預設維持原樣，需要的人再自己調低。
   */
  dimUnselected: 1
};
function fanStyle(geometry = {}) {
  const { arc, pivot, ratio, maxCardWidth, lift, selectedLift, dimUnselected } = {
    ...FAN_DEFAULTS,
    ...geometry
  };
  const arcDeg = `${arc}deg`;
  const widthPerCard = `(2 * (0.5 * cos(${arcDeg}) + ${ratio} * ${pivot} * sin(${arcDeg})))`;
  const heightPerCard = `(${ratio} * (${pivot} - ${pivot - 1} * cos(${arcDeg})) + 0.5 * sin(${arcDeg}))`;
  return {
    "--cp-arc": arcDeg,
    // 樞紐用「卡高的倍數」換算成固定長度，不用百分比。
    // 百分比是相對**元素實際高度**的：呼叫端在卡面上下多加一行字（位置標籤之類），
    // 元素一變高，旋轉中心就跟著往下跑，整張卡被甩到旁邊去。
    "--cp-pivot": `calc(var(--cp-card-h) * ${pivot})`,
    "--cp-lift": lift,
    "--cp-selected-lift": selectedLift,
    "--cp-dim": String(dimUnselected),
    // 卡寬取「理想寬」與「容器寬 ÷ 寬倍數」的較小者：扇形永遠剛好合身。
    // 100cqw 需要容器自己宣告 container-type: inline-size（見 fan-layout.css）。
    "--cp-card-w": `min(${maxCardWidth}, 100cqw / ${widthPerCard})`,
    "--cp-card-h": `calc(var(--cp-card-w) * ${ratio})`,
    // 頂端餘裕取兩種位移的較大者，所以呼叫端把 selectedLift 調大也不會被裁掉。
    // 同一個值也是 .cp-slot 的 top（見 fan-layout.css），抽起的卡剛好貼齊容器頂端。
    "--cp-fan-h": `calc(var(--cp-card-w) * ${heightPerCard} + var(--cp-headroom))`,
    "--cp-headroom": "max(var(--cp-lift), var(--cp-selected-lift))"
  };
}
function cardAngle(index, count, arc = FAN_DEFAULTS.arc) {
  if (count <= 1) return 0;
  return -arc + index * (arc * 2) / (count - 1);
}
var DEAL_DEFAULTS = {
  enterMs: 420,
  holdMs: 200,
  shuffleMs: 1400,
  shuffleRounds: 2,
  shuffleSpread: "86%",
  spreadMs: 460,
  staggerMs: 45,
  from: "18%",
  deckFan: 0.06
};
function dealStyle(count, deal) {
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
    deckFan
  } = deal === true ? DEAL_DEFAULTS : { ...DEAL_DEFAULTS, ...deal };
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
    "--cp-deck-fan": String(deckFan)
  };
}
function cutVars(index, count) {
  const half = Math.ceil(count / 2);
  const isTop = index >= half;
  return {
    // 橫向移開的倍數（乘上 shuffleSpread）。下半疊只稍微讓開，不是主角。
    "--cp-cut-x": isTop ? 1 : -0.12,
    // 只有被拿起來的那疊才抬高、才傾斜。
    "--cp-cut-top": isTop ? 1 : 0,
    // 切完之後的層級：上半疊整個沉到最底下，兩疊各自維持內部順序。
    "--cp-z-cut": isTop ? index - half : index + (count - half)
  };
}
function FanLayout({
  count,
  renderCard,
  picked = [],
  activeIndex = null,
  onPick,
  disabled = false,
  cardLabel,
  geometry,
  deal = true,
  className
}) {
  const arc = geometry?.arc ?? FAN_DEFAULTS.arc;
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: className === void 0 ? "cp-fan" : `cp-fan ${className}`,
      "data-has-selection": picked.length > 0,
      "data-deal": deal !== false,
      style: { ...fanStyle(geometry), ...dealStyle(count, deal) },
      children: /* @__PURE__ */ jsx("div", { className: "cp-fan-stage", children: Array.from({ length: count }, (_, index) => {
        const order = picked.indexOf(index);
        const state = {
          index,
          order,
          selected: order >= 0,
          active: activeIndex === index
        };
        return /* @__PURE__ */ jsx(
          "span",
          {
            className: "cp-slot",
            "data-selected": state.selected,
            style: { "--cp-z": index, ...cutVars(index, count) },
            children: /* @__PURE__ */ jsx(
              "span",
              {
                className: "cp-rotor",
                style: { "--cp-angle": `${cardAngle(index, count, arc)}deg` },
                children: /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    className: "cp-card",
                    "data-card-index": index,
                    "data-active": state.active,
                    disabled,
                    "aria-pressed": state.selected,
                    "aria-label": cardLabel?.(state) ?? `Card ${index + 1}`,
                    onClick: () => onPick?.(index),
                    children: renderCard(state)
                  }
                )
              }
            )
          },
          index
        );
      }) })
    }
  );
}
function applyPick(current, index, max, allowDeselect) {
  const at = current.indexOf(index);
  if (at >= 0) {
    return allowDeselect ? [...current.slice(0, at), ...current.slice(at + 1)] : current;
  }
  if (current.length >= max) return current;
  return [...current, index];
}
function useCardSelection(options) {
  const { max, value, onChange, onComplete, allowDeselect = false } = options;
  const controlled = value !== void 0;
  const [internal, setInternal] = useState([]);
  const picked = controlled ? value : internal;
  const onCompleteRef = useRef(onComplete);
  const onChangeRef = useRef(onChange);
  onCompleteRef.current = onComplete;
  onChangeRef.current = onChange;
  const pick = useCallback(
    (index) => {
      if (controlled) {
        const next = applyPick(value, index, max, allowDeselect);
        if (next !== value) onChangeRef.current?.(next);
        return;
      }
      setInternal((current) => applyPick(current, index, max, allowDeselect));
    },
    [controlled, value, max, allowDeselect]
  );
  const previous = useRef(null);
  useEffect(() => {
    if (controlled) return;
    if (previous.current !== null && previous.current !== internal) {
      onChangeRef.current?.(internal);
    }
    previous.current = internal;
  }, [controlled, internal]);
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current && picked.length >= max) {
      fired.current = true;
      onCompleteRef.current?.(picked);
    }
  }, [picked, max]);
  const reset = useCallback(() => {
    fired.current = false;
    if (controlled) {
      onChangeRef.current?.([]);
    } else {
      setInternal([]);
    }
  }, [controlled]);
  const orderOf = useCallback((index) => picked.indexOf(index), [picked]);
  return { picked, done: picked.length >= max, pick, reset, orderOf };
}

export { DEAL_DEFAULTS, FAN_DEFAULTS, FanLayout, cardAngle, dealStyle, fanStyle, useCardSelection };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map