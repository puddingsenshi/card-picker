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

需要 React 18 以上。手勢功能另外需要 `@mediapipe/tasks-vision`，不裝也能用其餘功能。

## 三個入口

| 入口 | 內容 |
|---|---|
| `@puddingsenshi/card-picker` | `FanLayout` 元件、`useCardSelection`、扇形幾何計算 |
| `.../pointer` | 指標抽象層：把任意輸入來源化約成一維指標 |
| `.../hand` | 手勢指標：用 MediaPipe 讀手部關節點，抓握判定 |
| `.../style.css` | `FanLayout` 的樣式，呼叫端自行 import 一次 |

## 最小用法

```tsx
import { FanLayout, useCardSelection } from '@puddingsenshi/card-picker';
import '@puddingsenshi/card-picker/style.css';

function Deck({ cards }) {
  const selection = useCardSelection({ total: cards.length, pick: 3 });
  return (
    <FanLayout
      cards={cards.map((c, i) => ({ id: c.id, ...selection.stateOf(i) }))}
      onPick={selection.pick}
    />
  );
}
```

## 為什麼把指標抽象出來

選牌的輸入方式不只一種：滑鼠、鍵盤、鏡頭手勢。這些的共同點是「最後都會變成一個沿著卡排移動的位置」。所以 `pointer` 把它們化約成同一個訊號，`hand` 只是其中一種實作。要加搖桿或觸控，補一個 hook 就好，`FanLayout` 不用改。

## 開發

```bash
bun install
bun test          # 45 個測試
bun run check-types
bun run build     # 產出 dist/
```

## 來源

原本是 [mystic-tarot](https://github.com/puddingsenshi/mystic-tarot) 的 workspace package，抽出來獨立維護，commit 歷史一併保留。
