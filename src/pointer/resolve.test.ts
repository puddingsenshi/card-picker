import { describe, expect, it } from "bun:test";
import { resolveSignal } from "./resolve";

/** 一個最小的卡片元素替身。`hitTest` 可注入，測試才不必起一整個 DOM。 */
function card(index: string | null, inside = true): Element {
  const element = {
    getAttribute: (name: string) => (name === "data-card-index" ? index : null),
    closest: (selector: string) =>
      selector === "[data-card-index]" && index !== null ? element : null,
    _inside: inside,
  };
  return element as unknown as Element;
}

/** 非卡片元素：closest 找不到東西。 */
const blank = { closest: () => null } as unknown as Element;

const container = {
  contains: (node: Element) => (node as unknown as { _inside: boolean })._inside,
} as unknown as Element;

describe("resolveSignal — 來源中斷", () => {
  it("訊號為 null 時沒有目標", () => {
    expect(resolveSignal(null)).toBeNull();
    expect(resolveSignal(null, { count: 13 })).toBeNull();
  });
});

describe("resolveSignal — index 型", () => {
  it("直接採用，不碰 DOM", () => {
    // hitTest 若被呼叫就會丟例外——證明一維訊號完全不經過命中測試。
    const hitTest = () => {
      throw new Error("index 型不該做命中測試");
    };
    expect(resolveSignal({ kind: "index", value: 5 }, { count: 13, hitTest })).toBe(5);
  });

  it("超出範圍夾在頭尾，而不是失去目標", () => {
    expect(resolveSignal({ kind: "index", value: -3 }, { count: 13 })).toBe(0);
    expect(resolveSignal({ kind: "index", value: 99 }, { count: 13 })).toBe(12);
  });

  it("小數四捨五入到最近的一張", () => {
    expect(resolveSignal({ kind: "index", value: 4.4 }, { count: 13 })).toBe(4);
    expect(resolveSignal({ kind: "index", value: 4.6 }, { count: 13 })).toBe(5);
  });

  it("不是有限數就沒有目標", () => {
    expect(resolveSignal({ kind: "index", value: Number.NaN }, { count: 13 })).toBeNull();
    expect(resolveSignal({ kind: "index", value: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it("沒有卡片時沒有目標", () => {
    expect(resolveSignal({ kind: "index", value: 0 }, { count: 0 })).toBeNull();
  });
});

describe("resolveSignal — point 型", () => {
  it("命中卡片就回傳它的索引", () => {
    const hitTest = () => card("7");
    expect(resolveSignal({ kind: "point", x: 10, y: 20 }, { count: 13, hitTest })).toBe(7);
  });

  it("座標會原封不動傳給命中測試", () => {
    const seen: number[][] = [];
    const hitTest = (x: number, y: number) => {
      seen.push([x, y]);
      return card("1");
    };
    resolveSignal({ kind: "point", x: 123, y: 456 }, { hitTest });
    expect(seen).toEqual([[123, 456]]);
  });

  it("指到空白處沒有目標", () => {
    expect(resolveSignal({ kind: "point", x: 0, y: 0 }, { hitTest: () => null })).toBeNull();
  });

  it("指到不是卡片的東西也沒有目標", () => {
    expect(resolveSignal({ kind: "point", x: 0, y: 0 }, { hitTest: () => blank })).toBeNull();
  });

  it("命中容器外的卡不算數", () => {
    const outside = () => card("3", false);
    expect(
      resolveSignal({ kind: "point", x: 0, y: 0 }, { hitTest: outside, container }),
    ).toBeNull();

    const inside = () => card("3", true);
    expect(resolveSignal({ kind: "point", x: 0, y: 0 }, { hitTest: inside, container })).toBe(3);
  });

  it("索引壞掉或超出範圍時沒有目標——不夾住，因為這代表 DOM 與預期不符", () => {
    expect(resolveSignal({ kind: "point", x: 0, y: 0 }, { hitTest: () => card("abc") })).toBeNull();
    expect(
      resolveSignal({ kind: "point", x: 0, y: 0 }, { count: 3, hitTest: () => card("9") }),
    ).toBeNull();
  });
});
