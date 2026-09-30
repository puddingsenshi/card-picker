# @puddingsenshi/card-picker

扇形／線性排列的選卡互動元件。**與任何牌組領域無關**——它只管「一排卡片怎麼擺、怎麼被選中」，不管卡片是塔羅、撲克還是別的東西。

```
      ╭─╮
   ╭─╮│ │╭─╮        ← 扇形排列，角度由卡寬推導
╭─╮│ ││ ││ │╭─╮
│ ││ ││ ││ ││ │
╰─╯╰─╯╰─╯╰─╯╰─╯
      ▲
   指標選中
```

## 安裝

```bash
bun add github:puddingsenshi/card-picker
# 或 npm install github:puddingsenshi/card-picker
```

`dist/` 不進版控，所以從 git 安裝時靠 `prepare` 在安裝端自己 build 一次。

需要 React 18 以上。手勢功能另外需要 `@mediapipe/tasks-vision`，不裝也能用其餘功能。

## 三個入口

| 入口 | 內容 |
|---|---|
| `@puddingsenshi/card-picker` | `FanLayout` 元件、`useCardSelection`、扇形幾何計算 |
| `.../pointer` | 指標抽象層：把任意輸入來源化約成一維指標 |
| `.../hand` | 手勢指標：用 MediaPipe 讀手部關節點，抓握判定 |
| `.../style.css` | `FanLayout` 的樣式，呼叫端自行 import 一次 |

## 最小用法

卡面**由呼叫端畫**。元件只決定「怎麼排、指到哪張、選了哪些」，不知道卡片長什麼樣。

```tsx
import { FanLayout, useCardSelection } from '@puddingsenshi/card-picker';
import '@puddingsenshi/card-picker/style.css';

function Deck() {
  const { picked, pick } = useCardSelection({
    max: 3,
    onComplete: () => console.log('選滿了'),
  });

  return (
    <FanLayout
      count={13}
      picked={picked}
      onPick={pick}
      renderCard={({ selected }) => (
        <span className={selected ? 'my-card my-card--picked' : 'my-card'} />
      )}
    />
  );
}
```

## 發牌動畫

預設開啟，四段接成一條時間軸：

```
0 ──── enter ──── hold ──── shuffle ──── stagger + spread ──→ 可點
       整疊浮現    停一拍     切牌         依序攤開
```

牌堆不另外畫——攤開前每張卡只轉到最終角度的 `deckFan` 倍，邊緣露出來就成了一疊。
切牌期間 `z-index` 真的會換：上半疊被拿起來、移到旁邊，回來時從下面插進去。
沒有這個換層，卡片再怎麼移動看起來都只是一疊牌在抖。

節奏全部可注入，`deal={false}` 整個關掉：

```tsx
<FanLayout deal={{ shuffleRounds: 1, shuffleMs: 700 }} ... />
```

| 參數 | 預設 | 作用 |
|---|---|---|
| `enterMs` | 420 | 整疊浮現 |
| `holdMs` | 200 | 牌堆停一拍 |
| `shuffleMs` | 1400 | 切牌總時間，設 0 跳過 |
| `shuffleRounds` | 2 | 切幾次 |
| `spreadMs` / `staggerMs` | 460 / 45 | 每張攤開的時間與間隔 |
| `deckFan` | 0.06 | 牌堆預攤開的比例 |

## 版面幾何

沒有任何量測出來的魔術數字——尺寸全部從卡寬與長寬比推導，用 CSS 的 `cos()` / `sin()`
即時求值，所以卡寬隨容器變化時高度與角度會自己跟上，不需要 `ResizeObserver`。

`geometry` 可注入：`arc`（張角）、`pivot`（旋轉中心）、`ratio`（長寬比）、
`maxCardWidth`、`lift`（被指向時推出的距離）、`selectedLift`、`dimUnselected`。

## 為什麼把指標抽象出來

選牌的輸入方式不只一種：滑鼠、鍵盤、鏡頭手勢。這些的共同點是「最後都會變成一個沿著卡排移動的位置」。所以 `pointer` 把它們化約成同一個訊號，`hand` 只是其中一種實作。要加搖桿或觸控，補一個 hook 就好，`FanLayout` 不用改。

## 開發

```bash
bun install
bun test          # 90 個測試
bun run check-types
bun run build     # 產出 dist/
```

## 來源

原本是 [mystic-tarot](https://github.com/puddingsenshi/mystic-tarot) 的 workspace package，抽出來獨立維護，commit 歷史一併保留。
