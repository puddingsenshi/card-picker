import { describe, expect, it } from "bun:test";
import {
  GRASP_DEFAULTS,
  graspRatio,
  initialRange,
  type Landmark,
  MIN_SCAN_WIDTH,
  nextGrasp,
  palmSpan,
  SCAN_STICKINESS,
  scanIndex,
  stickyIndex,
  widenRange,
} from "./landmarks";

/**
 * 造一隻手。
 *
 * 手腕在中指根部正下方 `palmSize` 處，四根指尖再往上 `tipDistance`——
 * 這樣 palmSpan 與指尖距離都能直接算出來，不必去查真實的 landmark 數值。
 */
function makeHand({
  palmX = 0.5,
  palmSize = 0.12,
  tipDistance = 0.26,
}: { palmX?: number; palmSize?: number; tipDistance?: number } = {}): Landmark[] {
  const hand: Landmark[] = Array.from({ length: 21 }, () => ({ x: palmX, y: 0.5 }));
  hand[0] = { x: palmX, y: 0.5 + palmSize };
  hand[9] = { x: palmX, y: 0.5 };
  for (const tip of [8, 12, 16, 20]) {
    hand[tip] = { x: palmX, y: 0.5 + palmSize - tipDistance };
  }
  return hand;
}

/** 張開的手：指尖遠離手腕。 */
const OPEN = makeHand({ tipDistance: 0.26 });
/** 握拳：指尖收回。 */
const FIST = makeHand({ tipDistance: 0.14 });

describe("palmSpan", () => {
  it("量的是手腕到中指根部", () => {
    expect(palmSpan(makeHand({ palmSize: 0.12 }))).toBeCloseTo(0.12, 6);
    expect(palmSpan(makeHand({ palmSize: 0.06 }))).toBeCloseTo(0.06, 6);
  });

  it("點不齊時沒有結果", () => {
    expect(palmSpan([])).toBeNull();
  });
});

describe("graspRatio", () => {
  it("張開時比值大、握拳時比值小", () => {
    const open = graspRatio(OPEN);
    const fist = graspRatio(FIST);
    expect(open).not.toBeNull();
    expect(fist).not.toBeNull();
    expect(open!).toBeGreaterThan(GRASP_DEFAULTS.open);
    expect(fist!).toBeLessThan(GRASP_DEFAULTS.close);
  });

  it("與手離鏡頭的遠近無關——分母是手掌尺寸", () => {
    const near = graspRatio(makeHand({ palmSize: 0.12, tipDistance: 0.26 }));
    const far = graspRatio(makeHand({ palmSize: 0.06, tipDistance: 0.13 }));
    expect(near!).toBeCloseTo(far!, 6);
  });
});

describe("nextGrasp — 遲滯", () => {
  it("張開狀態要夠小才算握緊", () => {
    expect(nextGrasp(false, 1.6)).toBe(false);
    expect(nextGrasp(false, 1.4)).toBe(true);
  });

  it("握緊狀態要夠大才算放開", () => {
    expect(nextGrasp(true, 1.6)).toBe(true);
    expect(nextGrasp(true, 1.9)).toBe(false);
  });

  it("停在兩個閾值之間時維持原狀，不會高速跳動", () => {
    const between = 1.65;
    expect(nextGrasp(false, between)).toBe(false);
    expect(nextGrasp(true, between)).toBe(true);
  });

  it("偵測不到手時維持原狀——閃失不該被當成放開", () => {
    expect(nextGrasp(true, null)).toBe(true);
    expect(nextGrasp(false, null)).toBe(false);
  });
});

describe("widenRange", () => {
  it("初始範圍以中央為心，寬度不為零", () => {
    const range = initialRange();
    expect(range.high - range.low).toBeCloseTo(MIN_SCAN_WIDTH, 6);
    expect((range.low + range.high) / 2).toBeCloseTo(0.5, 6);
  });

  it("掃到更外側就把邊界推出去", () => {
    const widened = widenRange(initialRange(), 0.1);
    expect(widened.low).toBeCloseTo(0.1, 6);
  });

  it("只擴不縮——已經掃到的邊界不會被收回來", () => {
    let range = widenRange(initialRange(), 0.05);
    range = widenRange(range, 0.95);
    range = widenRange(range, 0.5);
    expect(range.low).toBeCloseTo(0.05, 6);
    expect(range.high).toBeCloseTo(0.95, 6);
  });

  it("沒有變化時回傳原本那個物件", () => {
    const range = initialRange();
    expect(widenRange(range, 0.5)).toBe(range);
  });
});

describe("scanIndex — 映射", () => {
  const range = { low: 0.2, high: 0.8 };
  const scan = { count: 13, mirror: false, range };

  it("在範圍正中央就指中間那張", () => {
    expect(scanIndex(makeHand({ palmX: 0.5 }), scan)).toBe(6);
  });

  it("走到範圍兩端分別是頭尾那張", () => {
    expect(scanIndex(makeHand({ palmX: 0.2 }), scan)).toBe(0);
    expect(scanIndex(makeHand({ palmX: 0.8 }), scan)).toBe(12);
  });

  it("超出範圍夾在頭尾，不會失去目標", () => {
    expect(scanIndex(makeHand({ palmX: 0 }), scan)).toBe(0);
    expect(scanIndex(makeHand({ palmX: 1 }), scan)).toBe(12);
  });

  it("鏡像之後方向相反——使用者看到的是自己的鏡像", () => {
    const mirrored = { ...scan, mirror: true };
    expect(scanIndex(makeHand({ palmX: 0.2 }), mirrored)).toBe(12);
    expect(scanIndex(makeHand({ palmX: 0.8 }), mirrored)).toBe(0);
  });

  it("索引隨手的位置單調變化", () => {
    const seen = [0.25, 0.37, 0.5, 0.63, 0.75].map(
      (palmX) => scanIndex(makeHand({ palmX }), scan)!,
    );
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    }
  });
});

describe("scanIndex 配合 widenRange — 兩端一定碰得到", () => {
  it("手掃到哪，那裡就是頭尾那張", () => {
    // 模擬一個人只能舉到 0.3..0.7 的範圍——比初始範圍寬，但遠不到滿畫面。
    let range = initialRange();
    for (const x of [0.5, 0.42, 0.3, 0.58, 0.7]) range = widenRange(range, x);

    // 掃到的最外側就該是第一張與最後一張，不必把手移到鏡頭視野邊緣。
    expect(scanIndex(makeHand({ palmX: 0.3 }), { count: 13, mirror: false, range })).toBe(0);
    expect(scanIndex(makeHand({ palmX: 0.7 }), { count: 13, mirror: false, range })).toBe(12);
  });

  it("擴張過程中，新的最外側當幀就生效", () => {
    let range = initialRange();
    const x = 0.12;
    range = widenRange(range, x);
    expect(scanIndex(makeHand({ palmX: x }), { count: 13, mirror: false, range })).toBe(0);
  });
});

describe("stickyIndex — 邊界黏著", () => {
  it("沒有前一個目標時就是四捨五入", () => {
    expect(stickyIndex(null, 6.4, 13)).toBe(6);
    expect(stickyIndex(null, 6.6, 13)).toBe(7);
  });

  it("停在交界附近不跳動", () => {
    // 6 與 7 的分界在 6.5。在它兩側輕微抖動，目標必須維持不變。
    for (const position of [6.44, 6.5, 6.56, 6.62, 6.74]) {
      expect(stickyIndex(6, position, 13)).toBe(6);
    }
  });

  it("同一組抖動若沒有黏著就會來回跳——這正是要修掉的", () => {
    const naive = [6.44, 6.56, 6.44, 6.56].map((p) => Math.round(p));
    expect(new Set(naive).size).toBe(2);

    const sticky = [6.44, 6.56, 6.44, 6.56].map((p) => stickyIndex(6, p, 13));
    expect(new Set(sticky).size).toBe(1);
  });

  it("明確越界超過 25% 格寬才換", () => {
    expect(stickyIndex(6, 6.75, 13)).toBe(6);
    expect(stickyIndex(6, 6.76, 13)).toBe(7);
    expect(stickyIndex(6, 5.25, 13)).toBe(6);
    expect(stickyIndex(6, 5.24, 13)).toBe(5);
  });

  it("兩邊對稱——往左往右一樣難鬆手", () => {
    expect(stickyIndex(6, 6 + 0.5 + SCAN_STICKINESS, 13)).toBe(6);
    expect(stickyIndex(6, 6 - 0.5 - SCAN_STICKINESS, 13)).toBe(6);
  });

  it("手快速揮過去時一次跨好幾格，不是只走一格", () => {
    expect(stickyIndex(2, 9.1, 13)).toBe(9);
    expect(stickyIndex(11, 1.2, 13)).toBe(1);
  });

  it("位置超出頭尾就夾住", () => {
    expect(stickyIndex(6, -3, 13)).toBe(0);
    expect(stickyIndex(6, 99, 13)).toBe(12);
  });

  it("張數變少時，上一輪留下的舊索引會被夾回合法範圍", () => {
    expect(stickyIndex(11, 2, 5)).toBe(2);
    expect(stickyIndex(11, 3.9, 5)).toBe(4);
  });

  it("黏著寬度可以調——設 0 等於關掉", () => {
    expect(stickyIndex(6, 6.6, 13, 0)).toBe(7);
    expect(stickyIndex(6, 6.6, 13, 0.4)).toBe(6);
  });
});

describe("scanIndex — 接上邊界黏著", () => {
  const range = { low: 0.2, high: 0.8 };
  const base = { count: 13, mirror: false, range };

  /** 讓某一張卡的中心剛好落在 palmX 上。 */
  function palmXFor(index: number): number {
    return range.low + (index / (base.count - 1)) * (range.high - range.low);
  }

  it("不給 previous 就維持原本的行為", () => {
    expect(scanIndex(makeHand({ palmX: 0.5 }), base)).toBe(6);
  });

  it("停在交界抖動時目標不變", () => {
    // 6 與 7 的交界
    const edge = (palmXFor(6) + palmXFor(7)) / 2;
    const half = (palmXFor(7) - palmXFor(6)) / 2;
    for (const x of [edge - half * 0.1, edge, edge + half * 0.1]) {
      expect(scanIndex(makeHand({ palmX: x }), { ...base, previous: 6 })).toBe(6);
    }
  });

  it("越過交界繼續走才會換", () => {
    expect(scanIndex(makeHand({ palmX: palmXFor(7) }), { ...base, previous: 6 })).toBe(7);
  });
});
