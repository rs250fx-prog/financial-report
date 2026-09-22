# 同梱フォント

## inter-latin-var.woff2

Inter（可変フォント、latin サブセット）。SIL Open Font License 1.1 のため
自己ホストが認められている。

- 取得元：https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2
- ライセンス：SIL OFL 1.1 — https://github.com/rsms/inter/blob/master/LICENSE.txt
- 48KB。weight 100〜900 を1ファイルでカバーする

Google Fonts から配信すると、CSS だけで86KB、フォント本体が60ファイル以上に
分割されてレンダリングを数秒ブロックしていた。日本語（Zen Kaku Gothic New）は
unicode-range で363分割されるため自己ホストしても重く、システムフォントに
切り替えた。詳細は docs/SPEC.md の「書体」を参照。
