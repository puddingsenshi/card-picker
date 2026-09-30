import { describe, expect, it } from "bun:test";
import { cutVars, DEAL_DEFAULTS, dealStyle } from "./fan-layout";

/** 完整跑完一次發牌要多久：整疊浮現 → 停一拍 → 洗牌 → 最後一張攤完。 */
function totalOf(style: Record<string, string>): number {
  return Number(style["--cp-deal-total"]!.replace("ms", ""));
}

describe("dealStyle — 關閉", () => {
  it("deal 為 false 時不產生任何變數，卡片直接出現在最終位置", () => {
    expect(dealStyle(13, false)).toEqual({});
  });
});

describe("dealStyle — 預設", () => {
  const style = dealStyle(13, true);

  it("產出動畫需要的每一個變數", () => {
    expect(Object.keys(style).sort()).toEqual([
      "--cp-deal-enter",
      "--cp-deal-from",
      "--cp-deal-hold",
      "--cp-deal-rounds",
      "--cp-deal-shuffle",
      "--cp-deal-shuffle-round",
      "--cp-deal-shuffle-spread",
      "--cp-deal-spread",
      "--cp-deal-stagger",
      "--cp-deal-total",
      "--cp-deck-fan",
    ]);
  });

  it("總時長涵蓋四段全部跑完為止", () => {
    // 最後一張要等浮現、停頓、洗牌都結束，再等 stagger×(count-1) 才開始轉。
    const expected =
      DEAL_DEFAULTS.enterMs +
      DEAL_DEFAULTS.holdMs +
      DEAL_DEFAULTS.shuffleMs +
      DEAL_DEFAULTS.staggerMs * 12 +
      DEAL_DEFAULTS.spreadMs;
    expect(totalOf(style)).toBe(expected);
  });

  it("洗牌總時長平均分給每一輪", () => {
    expect(style["--cp-deal-rounds"]).toBe(String(DEAL_DEFAULTS.shuffleRounds));
    expect(style["--cp-deal-shuffle-round"]).toBe(
      `${DEAL_DEFAULTS.shuffleMs / DEAL_DEFAULTS.shuffleRounds}ms`,
    );
  });

  it("牌堆預先攤開一點點，不然一整副牌看起來只有一張", () => {
    expect(Number(style["--cp-deck-fan"])).toBeGreaterThan(0);
    expect(Number(style["--cp-deck-fan"])).toBeLessThan(1);
  });

  it("總時長隨張數增加——點擊不會在牌還在飛的時候放行", () => {
    expect(totalOf(dealStyle(20, true))).toBeGreaterThan(totalOf(dealStyle(3, true)));
  });

  it("只有一張時沒有錯開的時間，但洗牌照跑", () => {
    const base =
      DEAL_DEFAULTS.enterMs +
      DEAL_DEFAULTS.holdMs +
      DEAL_DEFAULTS.shuffleMs +
      DEAL_DEFAULTS.spreadMs;
    expect(totalOf(dealStyle(1, true))).toBe(base);
  });

  it("零張也不會算出負的時長", () => {
    expect(totalOf(dealStyle(0, true))).toBe(totalOf(dealStyle(1, true)));
  });
});

describe("dealStyle — 注入", () => {
  it("每個節奏都可以單獨調", () => {
    const style = dealStyle(5, {
      enterMs: 100,
      holdMs: 50,
      shuffleMs: 300,
      shuffleRounds: 2,
      spreadMs: 200,
      staggerMs: 10,
      from: "50%",
    });
    expect(style["--cp-deal-enter"]).toBe("100ms");
    expect(style["--cp-deal-hold"]).toBe("50ms");
    expect(style["--cp-deal-shuffle"]).toBe("300ms");
    expect(style["--cp-deal-shuffle-round"]).toBe("150ms");
    expect(style["--cp-deal-spread"]).toBe("200ms");
    expect(style["--cp-deal-stagger"]).toBe("10ms");
    expect(style["--cp-deal-from"]).toBe("50%");
    expect(totalOf(style)).toBe(100 + 50 + 300 + 10 * 4 + 200);
  });

  it("只覆寫一項，其餘沿用預設", () => {
    const style = dealStyle(13, { staggerMs: 0 });
    expect(style["--cp-deal-stagger"]).toBe("0ms");
    expect(style["--cp-deal-enter"]).toBe(`${DEAL_DEFAULTS.enterMs}ms`);
  });

  it("stagger 設 0 等於整把一起攤開", () => {
    const style = dealStyle(13, { staggerMs: 0 });
    expect(totalOf(style)).toBe(
      DEAL_DEFAULTS.enterMs +
        DEAL_DEFAULTS.holdMs +
        DEAL_DEFAULTS.shuffleMs +
        DEAL_DEFAULTS.spreadMs,
    );
  });

  it("shuffleMs 設 0 等於不洗牌，牌堆浮現後直接攤開", () => {
    const style = dealStyle(13, { shuffleMs: 0 });
    expect(style["--cp-deal-shuffle"]).toBe("0ms");
    expect(style["--cp-deal-shuffle-round"]).toBe("0ms");
    expect(totalOf(style)).toBe(
      DEAL_DEFAULTS.enterMs +
        DEAL_DEFAULTS.holdMs +
        DEAL_DEFAULTS.staggerMs * 12 +
        DEAL_DEFAULTS.spreadMs,
    );
  });

  it("shuffleRounds 給 0 或負數也不會除以零", () => {
    for (const rounds of [0, -3]) {
      const style = dealStyle(13, { shuffleRounds: rounds });
      expect(style["--cp-deal-rounds"]).toBe("1");
      expect(style["--cp-deal-shuffle-round"]).toBe(`${DEAL_DEFAULTS.shuffleMs}ms`);
    }
  });

  it("負的 shuffleMs 夾成 0，不會讓總時長倒退", () => {
    expect(dealStyle(13, { shuffleMs: -500 })["--cp-deal-shuffle"]).toBe("0ms");
  });
});

describe("cutVars — 誰被拿起來", () => {
  it("索引大的那半是上半疊，被整個拿起來", () => {
    // z-index 依卡序遞增，所以索引大的本來就疊在上面。
    expect(cutVars(6, 13)["--cp-cut-top"]).toBe(0);
    expect(cutVars(7, 13)["--cp-cut-top"]).toBe(1);
    expect(cutVars(12, 13)["--cp-cut-top"]).toBe(1);
  });

  it("下半疊只稍微往反方向讓開，不是主角", () => {
    expect(cutVars(0, 13)["--cp-cut-x"]).toBe(-0.12);
    expect(cutVars(12, 13)["--cp-cut-x"]).toBe(1);
  });

  it("兩疊都不會是空的", () => {
    const tops = Array.from({ length: 13 }, (_, i) => cutVars(i, 13)["--cp-cut-top"]);
    expect(tops).toContain(0);
    expect(tops).toContain(1);
  });
});

describe("cutVars — 切完的層級", () => {
  it("上半疊整個沉到最底下", () => {
    // 13 張切一半：7..12 這六張變成最底下的 0..5。
    expect(cutVars(7, 13)["--cp-z-cut"]).toBe(0);
    expect(cutVars(12, 13)["--cp-z-cut"]).toBe(5);
  });

  it("下半疊整個浮到最上面", () => {
    expect(cutVars(0, 13)["--cp-z-cut"]).toBe(6);
    expect(cutVars(6, 13)["--cp-z-cut"]).toBe(12);
  });

  it("每一疊內部的相對順序不變——切牌不會把一疊自己洗亂", () => {
    // 標成 tuple，不然 noUncheckedIndexedAccess 會把解構出來的值當成可能是 undefined。
    const neighbours: [number, number][] = [
      [0, 1],
      [5, 6],
      [7, 8],
      [11, 12],
    ];
    for (const [a, b] of neighbours) {
      expect(cutVars(a, 13)["--cp-z-cut"]!).toBeLessThan(cutVars(b, 13)["--cp-z-cut"]!);
    }
  });

  it("是 0..count-1 的雙射——不能有兩張搶同一層", () => {
    for (const count of [1, 2, 3, 12, 13, 20]) {
      const zs = Array.from({ length: count }, (_, i) => cutVars(i, count)["--cp-z-cut"]!);
      expect(new Set(zs).size).toBe(count);
      expect(Math.min(...zs)).toBe(0);
      expect(Math.max(...zs)).toBe(count - 1);
    }
  });

  it("只有一張時沒得切，層級不動", () => {
    expect(cutVars(0, 1)["--cp-z-cut"]).toBe(0);
  });
});
