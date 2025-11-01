# Change Log

All notable changes to the "latex-align-indent" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Respect VS Code の `tabSize` / `insertSpaces` 設定を使用してインデントを決定
- `latex-align-indent.skipTikz` で `tikzpicture` / `pgfplots` 系環境のフォーマットをスキップ可能に
- `\begin{...}[...]` や `\begin{...}{...}` の引数を行分割せず保持
- 中括弧ブロックのインデントを一般的なブロックスタイルに修正
- 保存時フォーマットで VS Code の標準 `WorkspaceEdit` を利用し、副作用を軽減
