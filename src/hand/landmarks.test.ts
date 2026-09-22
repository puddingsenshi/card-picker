import { describe, expect, it } from "bun:test";
import {
  GRASP_DEFAULTS,
  graspRatio,
  type Landmark,
  nextGrasp,
  palmSpan,
  scanIndex,
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

describe("scanIndex — 映射", () => {
  const scan = { count: 13, mirror: false, referencePalm: 0.12 };

  it("手在正中央就指中間那張", () => {
    expect(scanIndex(makeHand({ palmX: 0.5 }), scan)).toBe(6);
  });

  it("走到區間兩端分別是頭尾那張", () => {
    // span 0.65 → 區間是 0.175 .. 0.825
    expect(scanIndex(makeHand({ palmX: 0.175 }), scan)).toBe(0);
    expect(scanIndex(makeHand({ palmX: 0.825 }), scan)).toBe(12);
  });

  it("超出區間夾在頭尾，不會失去目標", () => {
    expect(scanIndex(makeHand({ palmX: 0 }), scan)).toBe(0);
    expect(scanIndex(makeHand({ palmX: 1 }), scan)).toBe(12);
  });

  it("鏡像之後方向相反——使用者看到的是自己的鏡像", () => {
    const mirrored = { ...scan, mirror: true };
    expect(scanIndex(makeHand({ palmX: 0.175 }), mirrored)).toBe(12);
    expect(scanIndex(makeHand({ palmX: 0.825 }), mirrored)).toBe(0);
  });

  it("索引隨手的位置單調變化", () => {
    const seen = [0.2, 0.35, 0.5, 0.65, 0.8].map((palmX) => scanIndex(makeHand({ palmX }), scan)!);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!).toBeGreaterThan(seen[i - 1]!);
    }
  });
});

describe("scanIndex — 遠近正規化", () => {
  it("手離遠一點時，同樣的位移掃過更多張", () => {
    const near = { count: 13, mirror: false, referencePalm: 0.12 };
    const offset = 0.1;

    const nearSpread = Math.abs(
      scanIndex(makeHand({ palmX: 0.5 + offset, palmSize: 0.12 }), near)! -
        scanIndex(makeHand({ palmX: 0.5, palmSize: 0.12 }), near)!,
    );
    // 手掌只剩一半大＝離鏡頭更遠，有效區間跟著縮小，同樣的位移就跨更多張。
    const farSpread = Math.abs(
      scanIndex(makeHand({ palmX: 0.5 + offset, palmSize: 0.06 }), near)! -
        scanIndex(makeHand({ palmX: 0.5, palmSize: 0.06 }), near)!,
    );
    expect(farSpread).toBeGreaterThan(nearSpread);
  });

  it("不論遠近，手在正中央都指中間那張", () => {
    const scan = { count: 13, mirror: false, referencePalm: 0.12 };
    expect(scanIndex(makeHand({ palmX: 0.5, palmSize: 0.2 }), scan)).toBe(6);
    expect(scanIndex(makeHand({ palmX: 0.5, palmSize: 0.05 }), scan)).toBe(6);
  });
});
