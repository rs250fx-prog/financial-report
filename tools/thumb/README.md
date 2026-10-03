# note 用サムネイルの部品

`tools/make-thumb.mjs` が読む。

## base.png

固定の背景（1280×670）。Figma で組んだサムネイルの書き出しから、号ごとに変わる
部分（上部バーの文字・日付・大中小の見出し・数値5枠の文字）を抜いたもの。
枠・ラベル・チャートの背景・署名は残してある。

**デザインを変えるときは、Figma から背景だけを書き出してこのファイルを差し替える。**
文字の位置と大きさは `make-thumb.mjs` の側にある。

## fonts/

実行環境にフォントが入っていなくても同じ見た目になるよう、同梱している。
スクリプトはフォントファイルから文字の輪郭を取り出して描くので、OS のフォント設定に依らない。

| ファイル | 用途 | ライセンス |
|---|---|---|
| `BebasNeue-Regular.ttf` | 数字・日付・英字ラベル | SIL OFL 1.1（`OFL-BebasNeue.txt`） |
| `NotoSansJP-VF.ttf` | 見出しの日本語（太さは可変） | SIL OFL 1.1 |
| `NotoSerifJP-Regular.ttf` | 数値5枠の寸評 | SIL OFL 1.1 |
| `ShareTechMono-Regular.ttf` | 上部バー | SIL OFL 1.1 |

`NotoSerifJP-Regular.ttf` は可変フォントから wght=400 を切り出した静的版
（可変版は13.6MBあり、使う太さは1つだけのため）。
