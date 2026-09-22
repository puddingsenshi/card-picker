import { describe, expect, it } from "bun:test";
import { applyPick } from "./use-card-selection";

describe("applyPick — 張數上限", () => {
  it("未達上限時依序加入", () => {
    expect(applyPick([], 3, 3, false)).toEqual([3]);
    expect(applyPick([3], 7, 3, false)).toEqual([3, 7]);
  });

  it("已達上限就不再加", () => {
    const full = [1, 2, 3];
    expect(applyPick(full, 9, 3, false)).toEqual(full);
  });

  it("選取順序即加入順序——位置標籤靠它對應", () => {
    let picked: number[] = [];
    for (const index of [11, 0, 5]) picked = applyPick(picked, index, 3, false);
    expect(picked).toEqual([11, 0, 5]);
  });
});

describe("applyPick — 重複選", () => {
  it("預設不可取消，重複選回傳原本那個參考", () => {
    const current = [4];
    // 回傳同一個參考，React 才能據此略過 re-render。
    expect(applyPick(current, 4, 3, false)).toBe(current);
  });

  it("allowDeselect 時重複選等於取消", () => {
    expect(applyPick([4, 8], 4, 3, true)).toEqual([8]);
  });

  it("取消後可以再選，且排到最後", () => {
    const after = applyPick([4, 8], 4, 3, true);
    expect(applyPick(after, 4, 3, true)).toEqual([8, 4]);
  });
});

describe("applyPick — 不變性", () => {
  it("不修改傳入的陣列", () => {
    const current = [1];
    applyPick(current, 2, 3, false);
    expect(current).toEqual([1]);
  });

  it("沒有變化時一律回傳原參考", () => {
    const full = [1, 2];
    expect(applyPick(full, 5, 2, false)).toBe(full);
    expect(applyPick(full, 1, 2, false)).toBe(full);
  });
});
