# Spec

這三份是這個套件的行為規格，原本住在 [mystic-tarot](https://github.com/puddingsenshi/mystic-tarot)
的 OpenSpec 流程裡（change `mt-107-card-picker`）。套件拆出來之後規格跟著搬過來——
描述的行為在這個 repo 實作，規格就該放在這個 repo。

| 檔案 | 範圍 |
|---|---|
| [card-picker.md](card-picker.md) | 版面幾何、選取狀態機、發牌動畫、命中標記 |
| [pointer-source.md](pointer-source.md) | 指標抽象層：一維指標的型別與行為 |
| [gesture-input.md](gesture-input.md) | 手部追蹤：掃描、遲滯、握拳、隱私、體積隔離 |

**不在這裡的**：選牌方式的切換 UI、降級提示的文案、送出的 payload 長什麼樣——
那些屬於呼叫端，留在 mystic-tarot 的 `openspec/specs/gesture-input/`。

規格用 SHALL / MUST NOT 陳述行為，每條需求底下是可驗證的情境。改行為時連規格一起改。
