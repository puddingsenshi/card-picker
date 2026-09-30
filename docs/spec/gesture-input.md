# gesture-input

## Purpose

以鏡頭做手部追蹤的一維指標：張開手掌左右掃描、握拳確認。推論全部在本機執行。

選牌方式的切換 UI、降級提示文案、送出的 payload 屬於呼叫端，不在這裡。

## Requirements

### Requirement: 手掌一維掃描

系統 SHALL 以手掌中心（landmark 9）的水平位置映射到卡片索引，MUST NOT 使用指尖作為指標點。垂直位置 SHALL 被忽略。

#### Scenario: 手左右移動切換目標
- **WHEN** 使用者張開手掌並水平移動
- **THEN** 目標索引隨之改變，且索引方向與使用者看到的鏡像方向一致

#### Scenario: 手上下移動不影響選擇
- **WHEN** 手掌在垂直方向移動而水平位置不變
- **THEN** 目標索引不變

#### Scenario: 超出有效區間
- **WHEN** 手移動到映射區間之外
- **THEN** 目標索引夾在第一張或最後一張，不會失去目標

#### Scenario: 兩端一定碰得到
- **WHEN** 使用者把手掃到自己能舒服舉到的最左或最右
- **THEN** 目標為第一張或最後一張——掃描範圍以實際掃過的位置為準，不得要求使用者把手移到鏡頭視野邊緣

#### Scenario: 遠近與坐姿不需校準
- **WHEN** 換人使用、改變與鏡頭的距離，或換個坐姿
- **THEN** 掃描範圍自動適應，不需要任何校準步驟

### Requirement: 邊界黏著

目標索引 SHALL 具備遲滯（hysteresis），避免手停在兩張卡交界時高速跳動。

#### Scenario: 停在交界不跳動
- **WHEN** 手掌停在兩張卡的分界線附近且僅有輕微抖動
- **THEN** 目標索引保持不變

#### Scenario: 明確越界才換
- **WHEN** 手掌越過分界線並繼續移動超過約 25% 格寬
- **THEN** 目標索引切換到相鄰那張

### Requirement: 握拳確認

握拳 SHALL 確認選取當前目標。選取後 MUST 先張開手，才能進行下一次選取。

#### Scenario: 握拳選取
- **WHEN** 目標為第 i 張且偵測到手由張開轉為握拳
- **THEN** 第 i 張被加入已選集合

#### Scenario: 握拳瞬間鎖定目標
- **WHEN** 偵測到開始握拳
- **THEN** 以該幀的目標索引為準，後續手部位移不改變本次選取的對象

#### Scenario: 不鬆開不能連選
- **WHEN** 選取後手維持握拳狀態
- **THEN** 不再產生新的選取，直到偵測到手重新張開

### Requirement: 本機推論與隱私

手部偵測 SHALL 完全在瀏覽器本機執行。影像 MUST NOT 上傳、MUST NOT 錄製或留存。

#### Scenario: 影像不離開裝置
- **WHEN** AR 模式運作中
- **THEN** 不存在任何攜帶影像資料的網路請求

#### Scenario: 離開選牌階段即停止
- **WHEN** 使用者離開選牌階段，或頁面進入背景
- **THEN** 停止推論迴圈並關閉 video track

### Requirement: 體積隔離

AR 相關程式與模型 SHALL 動態載入。不使用 AR 的情況下 MUST NOT 增加初始 bundle 體積。

#### Scenario: 未開啟 AR 不載入模型
- **WHEN** 使用者未開啟 AR 模式
- **THEN** 不發出任何手部模型或 MediaPipe 相關資源的請求
