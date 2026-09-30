import { a as PointerSignal, P as PointerInput } from '../types-Bw59kwoR.js';

interface ResolveOptions {
    /** 卡片總數。給了才能把索引夾在有效範圍內。 */
    count?: number;
    /**
     * 命中測試。預設用 `document.elementFromPoint`。
     *
     * 可注入是為了兩件事：測試不必起一個完整的 DOM，以及 SSR 期間不去碰 document。
     */
    hitTest?: (x: number, y: number) => Element | null;
    /** 限定只認這個容器裡的卡。多個選卡區同時存在時用得到。 */
    container?: Element | null;
}
/**
 * 把指標訊號解析成「指著第幾張」。
 *
 * 座標型走 `document.elementFromPoint`，不自己算幾何。扇形的卡互相旋轉重疊，
 * 手刻命中判定要處理 transform 與堆疊順序，而瀏覽器的命中測試已經把這些算進去了——
 * 用它，手勢游標指到的卡就保證跟滑鼠指到的是同一張。
 */
declare function resolveSignal(signal: PointerSignal | null, options?: ResolveOptions): number | null;

interface UseKeyboardPointerOptions {
    count: number;
    enabled?: boolean;
    /** 起點。預設正中央——扇形的中間那張是最自然的起手位置。 */
    initialIndex?: number;
}
/**
 * 用鍵盤模擬一維指標。
 *
 * 它本身是個能用的鍵盤操作方式，但真正的用途是**替手勢層打樣**：
 * 左右鍵等於手掌左右移動、按住 Enter 等於握拳、放開等於張開手。
 * 有了它，選取流程（latch、必須放開才能再選、來源中斷）可以在完全不碰鏡頭的
 * 情況下驗證完，之後接上 MediaPipe 時就只剩「landmark 換算成索引」這一件事。
 */
declare function useKeyboardPointer({ count, enabled, initialIndex, }: UseKeyboardPointerOptions): PointerInput;

interface UsePointerSelectionOptions extends ResolveOptions {
    /** 指標來源的輸出。`null` 表示這個來源沒在運作。 */
    input: PointerInput | null;
    /** 確認選取時呼叫。 */
    onPick: (index: number) => void;
    /** 關掉時立刻清除目標，且不再觸發選取。例如已經選滿。 */
    enabled?: boolean;
}
/**
 * 把指標訊號接成選取行為。
 *
 * 這裡實作了兩件對所有輸入來源都成立的規則，所以手勢層只要如實回報「有沒有握拳」：
 *
 * 1. **Latch**：選取用的是「開始按住的那一刻」指著的那張，之後手怎麼飄都不改。
 *    握拳、按鍵、點擊——任何確認動作都會讓指標稍微位移，不鎖住就會選到隔壁。
 * 2. **必須放開才能再選**：按住不放不會連選。
 */
declare function usePointerSelection({ input, onPick, enabled, count, container, hitTest, }: UsePointerSelectionOptions): {
    target: number | null;
};

export { PointerInput, PointerSignal, type ResolveOptions, type UseKeyboardPointerOptions, type UsePointerSelectionOptions, resolveSignal, useKeyboardPointer, usePointerSelection };
