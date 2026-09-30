# pointer-source

## Purpose

指標抽象層：把任意輸入來源（滑鼠、鍵盤、手勢）化約成沿卡排移動的一維指標。

## Requirements

### Requirement: 兩種指標型別

指標訊號 SHALL 支援座標型與索引型兩種表達。選取邏輯 MUST NOT 依賴訊號來自哪一種輸入裝置。

#### Scenario: 座標型解析成索引
- **WHEN** 收到 `{ kind: "point", x, y }`
- **THEN** 以 `document.elementFromPoint` 找出該座標下最近的 `[data-card-index]`，其值即為目標索引

#### Scenario: 索引型直接採用
- **WHEN** 收到 `{ kind: "index", value }`
- **THEN** 直接以該值為目標索引，不進行任何 DOM 命中測試

#### Scenario: 指到空白處
- **WHEN** 座標落在任何卡片之外
- **THEN** 目標索引為無，且不改變既有的已選集合

### Requirement: 與滑鼠行為一致

座標型指標的命中結果 SHALL 與滑鼠在同一座標的命中結果相同，包含旋轉與堆疊順序的影響。

#### Scenario: 重疊處以堆疊順序決定
- **WHEN** 座標落在兩張互相重疊的卡上
- **THEN** 命中的是視覺上位於較上層的那一張

### Requirement: 指標消失的處理

當指標來源中斷時，元件 SHALL 維持既有狀態，MUST NOT 誤觸發選取。

#### Scenario: 來源中斷
- **WHEN** 指標來源停止送出訊號
- **THEN** 目標索引清除、已選集合不變、不呼叫 `onComplete`
