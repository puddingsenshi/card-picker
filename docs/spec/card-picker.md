# card-picker

## Purpose

扇形／線性排列的選卡互動：版面幾何、選取狀態機、發牌動畫。與任何牌組領域無關。

## Requirements

### Requirement: 與領域無關

`card-picker` package MUST NOT 依賴任何塔羅領域的模組。卡面外觀 SHALL 由呼叫端透過 render prop 注入；元件本身不得知道牌名、牌義或牌陣。

#### Scenario: 零領域依賴
- **WHEN** 檢查 `packages/card-picker` 的 import
- **THEN** 不存在對 `@mystic-tarot/api`、`@mystic-tarot/db` 或任何塔羅資料的引用

#### Scenario: 卡面由外部注入
- **WHEN** 呼叫端提供 `renderCard({ index, selected, active })`
- **THEN** 元件以該回傳值作為每張卡的內容，自身不渲染任何卡面樣式

### Requirement: 扇形版面幾何

扇形 SHALL 以位於卡面下方的樞紐旋轉排開，角度在 `[-FAN_ARC, +FAN_ARC]` 之間等距分佈。容器高度 SHALL 由卡片寬度與長寬比推導，不得寫死長度值。

#### Scenario: 卡片尺寸改變時版面不破
- **WHEN** 呼叫端傳入不同的卡片寬度
- **THEN** 容器高度隨之調整，扇形不被裁切，上方不留多餘空白

#### Scenario: 索引順序與視覺順序一致
- **WHEN** 扇形排出 N 張卡
- **THEN** 索引 0 在最左、索引 N-1 在最右，兩者順序嚴格一致

### Requirement: 版面可替換

選取邏輯 SHALL 與版面解耦，使扇形以外的排法（橫排、網格）能沿用同一套狀態機。

#### Scenario: 換版面不改選取行為
- **WHEN** 以不同 layout 元件搭配同一個選取狀態機
- **THEN** 選取、取消、張數限制的行為完全一致

### Requirement: 發牌動畫

卡片首次出現時 SHALL 先疊成一疊，再依序攤開成最終版面。動畫期間 MUST NOT 接受點擊。
呼叫端 SHALL 能調整節奏或整個關閉。

#### Scenario: 從一疊攤開
- **WHEN** 選卡區首次出現
- **THEN** 所有卡先重疊於同一位置，接著一張接一張轉到各自的位置

#### Scenario: 牌還在飛時不能選
- **WHEN** 動畫尚未結束時點擊
- **THEN** 不產生選取——使用者以為選的是看到的那張，實際會落在它即將飛去的位置

#### Scenario: 動畫結束即可操作
- **WHEN** 最後一張攤開完成
- **THEN** 恢復接受點擊

#### Scenario: 可關閉
- **WHEN** 呼叫端關閉發牌動畫
- **THEN** 卡片直接出現在最終位置，且照常可以點擊

#### Scenario: 尊重系統的減少動態設定
- **WHEN** 使用者的系統設定為減少動態效果
- **THEN** 略過動畫，但仍正常可以點擊

### Requirement: 選取狀態機

元件 SHALL 支援受控與非受控兩種模式，並支援最少／最多張數限制。已選的卡 SHALL NOT 因重複指向而被重複計入。

#### Scenario: 選滿即通知
- **WHEN** 已選張數達到上限
- **THEN** 呼叫 `onComplete`，且只呼叫一次

#### Scenario: 重複選同一張無效
- **WHEN** 指向一張已被選走的卡並確認
- **THEN** 已選集合不變

#### Scenario: 受控模式
- **WHEN** 呼叫端傳入 `value` 與 `onChange`
- **THEN** 元件不保留內部選取狀態，一切以 `value` 為準

### Requirement: 命中標記

每張卡 SHALL 在 DOM 上標記自身索引，作為 core 與 pointer 之間唯一的契約。

#### Scenario: 索引可由 DOM 反查
- **WHEN** 任一張卡被渲染
- **THEN** 其 DOM 節點帶有 `data-card-index` 屬性，值為該卡索引
