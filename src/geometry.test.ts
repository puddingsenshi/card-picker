import { describe, expect, it } from "bun:test";
import { cardAngle, FAN_DEFAULTS, fanStyle } from "./geometry";

describe("cardAngle", () => {
  it("兩端剛好是 ±arc，正中央是 0", () => {
    expect(cardAngle(0, 13, 34)).toBe(-34);
    expect(cardAngle(12, 13, 34)).toBe(34);
    expect(cardAngle(6, 13, 34)).toBeCloseTo(0, 10);
  });

  it("角度隨索引嚴格遞增——索引順序與視覺左右順序一致靠的就是這個", () => {
    const angles = Array.from({ length: 13 }, (_, i) => cardAngle(i, 13, 34));
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]!).toBeGreaterThan(angles[i - 1]!);
    }
  });

  it("只有一張時不旋轉", () => {
    expect(cardAngle(0, 1)).toBe(0);
  });
});

describe("fanStyle", () => {
  it("產出版面需要的每一個變數", () => {
    const style = fanStyle();
    expect(Object.keys(style).sort()).toEqual([
      "--cp-arc",
      "--cp-card-h",
      "--cp-card-w",
      "--cp-dim",
      "--cp-fan-h",
      "--cp-headroom",
      "--cp-lift",
      "--cp-pivot",
      "--cp-selected-lift",
    ]);
  });

  it("角度與樞紐直接反映參數", () => {
    const style = fanStyle({ arc: 20, pivot: 3 });
    expect(style["--cp-arc"]).toBe("20deg");
    // 樞紐換算成卡高的倍數，不是百分比——百分比會隨元素實際高度漂移。
    expect(style["--cp-pivot"]).toBe("calc(var(--cp-card-h) * 3)");
  });

  it("樞紐不用百分比，卡面多一行字也不會讓旋轉中心跑掉", () => {
    expect(fanStyle()["--cp-pivot"]).not.toInclude("%");
    expect(fanStyle()["--cp-pivot"]).toInclude("var(--cp-card-h)");
  });

  it("卡寬夾在理想寬與容器寬之間，不會溢出容器", () => {
    const style = fanStyle({ maxCardWidth: "5rem" });
    expect(style["--cp-card-w"]).toStartWith("min(5rem,");
    expect(style["--cp-card-w"]).toInclude("100cqw");
  });

  it("高度由卡寬推導，且含推出的餘裕", () => {
    const style = fanStyle();
    expect(style["--cp-fan-h"]).toInclude("var(--cp-card-w)");
    expect(style["--cp-fan-h"]).toInclude("var(--cp-headroom)");
  });

  it("頂端餘裕取兩種位移的較大者——抽高調大也不會被裁掉", () => {
    const style = fanStyle();
    expect(style["--cp-headroom"]).toInclude("max(");
    expect(style["--cp-headroom"]).toInclude("var(--cp-lift)");
    expect(style["--cp-headroom"]).toInclude("var(--cp-selected-lift)");
  });

  it("選中的抽高與未選的淡化都可由呼叫端注入", () => {
    const style = fanStyle({ selectedLift: "7rem", dimUnselected: 0.75 });
    expect(style["--cp-selected-lift"]).toBe("7rem");
    expect(style["--cp-dim"]).toBe("0.75");
  });

  it("預設選中停在滑過時的高度，也不淡化其他卡", () => {
    const style = fanStyle();
    // 選走一張就停在剛才被指到的位置，不再往上跑，也不把鄰卡壓暗。
    expect(style["--cp-selected-lift"]).toBe("var(--cp-lift)");
    expect(style["--cp-dim"]).toBe("1");
  });

  it("預設的頂端餘裕由 lift 決定，不因選取而變高", () => {
    const style = fanStyle();
    expect(style["--cp-headroom"]).toBe("max(var(--cp-lift), var(--cp-selected-lift))");
  });

  it("想要更突出時可以調大抽高，餘裕自動跟上", () => {
    const style = fanStyle({ selectedLift: "6rem" });
    expect(style["--cp-selected-lift"]).toBe("6rem");
    expect(style["--cp-headroom"]).toInclude("var(--cp-selected-lift)");
  });

  it("dimUnselected 設成 1 等於關掉淡化", () => {
    expect(fanStyle({ dimUnselected: 1 })["--cp-dim"]).toBe("1");
  });

  it("預設值與 MT-103 的原始外觀一致", () => {
    expect(FAN_DEFAULTS.arc).toBe(34);
    expect(FAN_DEFAULTS.pivot).toBe(2.6);
    expect(FAN_DEFAULTS.ratio).toBeCloseTo(19 / 11, 10);
  });
});

/**
 * 幾何推導的迴歸測試。
 *
 * 公式見 geometry.ts 開頭；這裡把它獨立算一次，確保 CSS 字串裡的係數沒被改壞。
 * 對照舊實作的量測值：扇形寬約卡寬的 6 倍、高約卡高的 1.46 倍。
 */
describe("幾何推導對照舊實作的量測值", () => {
  const { arc, pivot, ratio } = FAN_DEFAULTS;
  const rad = (arc * Math.PI) / 180;

  it("扇形寬約為卡寬的 5.85 倍（舊註解量到「約 6 倍」）", () => {
    const widthPerCard = 2 * (0.5 * Math.cos(rad) + ratio * pivot * Math.sin(rad));
    expect(widthPerCard).toBeCloseTo(5.85, 2);
  });

  it("扇形高約為卡高的 1.44 倍（舊註解量到 1.46 倍）", () => {
    const heightPerCard = ratio * (pivot - (pivot - 1) * Math.cos(rad)) + 0.5 * Math.sin(rad);
    expect(heightPerCard / ratio).toBeCloseTo(1.44, 2);
  });
});
