---
# ファイル名を発行日にする（例: 2026-09-22.md）。それがURLになる。
# アンダースコア始まりのファイルはビルドに含まれないため、
# このテンプレート自体は公開されない。

no: 0
title: "見出し。40字以内を目安に"
deck: "リード文。TOPのヒーローと一覧の抜粋に出る。120〜180字程度"
date: "2026-01-01"
# updated: "07:30 JST"

# 本日の要点。3〜5件。1件60字程度。TOPのサイドバーに 01.. と並ぶ
points:
  - "要点その1"
  - "要点その2"
  - "要点その3"
  - "要点その4"

# マーケット・スナップショット。6件を想定（ティッカーにも同じ値が流れる）
# dir は up / down / flat
snapshot:
  - { label: "XAU / USD",    value: "0,000.00", change: "+0.00%", dir: up }
  - { label: "ドル指数 DXY", value: "00.00",    change: "-0.00%", dir: down }
  - { label: "米10年金利",   value: "0.000%",   change: "-0.0bp", dir: down }
  - { label: "実質金利 10Y", value: "0.000%",   change: "-0.0bp", dir: down }
  - { label: "WTI原油",      value: "00.00",    change: "+0.00%", dir: up }
  - { label: "BTC / USD",    value: "000,000",  change: "-0.00%", dir: down }

# 一覧の右端に出す代表値。通常は XAU/USD の変化率
headline: { value: "+0.00%", dir: up }

tags: ["実質金利", "XAU/USD"]

description: "検索結果に出る説明文。未記入なら deck が使われる"
keywords: []
# ogImage: "/og/2026-01-01.png"

draft: true       # 書き上がったら false
unlisted: false   # 一覧に出さずURLだけで見せたいとき true
access: public    # クローズ化フェーズで members を使う
---

本文をここから書く。見出しは `##` から始める（`#` はタイトルが使うため）。

## 見出し

段落。
