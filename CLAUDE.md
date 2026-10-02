# 專案說明（給 Claude）

## 這是什麼
Tom 規劃的「小小創客階梯 MakerSteps」（副標：兒童科技學習路線圖）：幼兒到國中的科技教材與課程規劃，做成單一 HTML 網頁。

## 使用者偏好
- 一律用繁體中文回覆與撰寫內容。
- Tom 不使用命令列：不要給需要自己打指令的步驟，改動直接由 Claude 完成並提交。
- 內容要有來源；查到的數字、年齡建議附上原始連結。
- **網頁要像專業的兒童教育網站：頁面上不放備註、來源說明、查詢日期、版本說明或內部註記。** 這些一律只記在 `REFERENCES.md`。「教材資源」的卡片連結和內文的教學資源是內容，不算備註。
- **每次更新都要記錄參考資料**：新增或改動的來源（名稱、連結、用在網頁哪裡、採用的內容）寫進 `REFERENCES.md`，並在該檔「更新紀錄」加一筆。沒有來源的內容列在「尚缺來源」。

## 檔案結構
- `BRAND.md`：網站名稱定案、備選名單與理由。改名或加標語時先看這裡。
- `index.html`：全部 HTML、CSS、JS 都在這一個檔案，不使用建置工具。
  - 導覽分兩層：第一層是路線（`總覽` + `[data-route="print3d"]` 3D 建模與列印）；選到 3D 時出現第二層 `#sub-print3d`。
  - 所有分頁按鈕都是 `nav.top [data-tab]`，切換 `<section>`：overview（總覽），以及 3D 路線底下的 print3d、stages、software、safety、resources。
  - 之後新增其他路線時，比照 3D：加一個 `data-route` 按鈕和一列子分頁。
  - 圖表（總覽矩陣、軟體年齡圖、教材數量圖）都由 JS 依頁面資料產生，不用外部函式庫。
  - 「分齡細節」內有年齡子分頁（`[data-stage]` → `#s1`–`#s5`）。CREATE 能力框架只涵蓋 10 歲以上，所以不另開分頁，改放在 s4（基礎級）、s5（中級＋延伸進階級）的 `details.create` 裡，年級用台灣學制。
  - 「教材資源」卡片用 `data-region`（tw / intl）與 `data-lv`（s2–s5、adult）篩選。
  - 顏色全部是 `:root` 上的 CSS 變數，含深色模式；年齡段顏色 `--l1`–`--l5`。
  - 必須保留 `[hidden]{display:none!important}`，否則分頁在某些檢視器不會切換。
  - `history.replaceState` 要包在 try/catch（`setHash()`），沙盒 iframe 會拒絕。

## 年齡段定義
| 代號 | 年齡段 |
| --- | --- |
| s1 | 幼兒 3–6 歲 |
| s2 | 低年級 6–8 歲 |
| s3 | 中年級 8–10 歲 |
| s4 | 高年級 10–12 歲 |
| s5 | 國中 12 歲以上 |

## 主要參考來源
- 仁愛國小電腦教室教材網 https://sites.google.com/view/raeseclass
- 碧華國小創客教育中心（3D 列印與建模）
- CREATE Education 3D Printing Skills Progression Framework
- Nozzle Down TinkerCAD 家長指南
- 新南國小 Tinkercad 教材、新興國中 Fusion 360 教學（臺南）

## 待辦
- [ ] 程式設計路線：補成和 3D 列印一樣的分頁細節（程式建模工具 Tinkercad Codeblocks、BlocksCAD 已從 3D 路線移出，歸到這條）
- [ ] 實體運算與機器人路線
- [ ] AI 路線
- [ ] 軟體應用與數位素養路線
- [ ] 中年級 Tinkercad 單元順序：對應蔡依帆播放清單的實際影片標題（目前是自訂順序）
- [ ] 中文教材缺口：幼兒、低年級、國中階段可考慮自編教材
