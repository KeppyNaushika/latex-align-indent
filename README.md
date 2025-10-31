# LaTeX Align Indent

LaTeX文書の包括的なフォーマット拡張機能です。表組み環境の整列、インデント、中括弧の整形、環境の改行処理に対応しています。

## 主な機能

### 表組み環境の自動整列
- `align`, `tabular`, `array` 環境などの自動整列
- 全角文字の幅を正確に計算してアライメント
- `&` 区切りでの列整列

### インデント処理
- LaTeX環境内の自動インデント
- VS Code の `tabSize` / `insertSpaces` 設定を尊重
- `\begin{}`/`\end{}` のネストに対応したインデント
- **`\foreach` ループの中括弧内インデント**
- 基本的なLaTeXコマンドのインデント

### 中括弧フォーマット
- **複数行にわたる中括弧内の自動インデント**
- `\foreach` や `\pgffor` などのループコマンド対応
- 中括弧前後のスペース調整

### 環境の改行処理
- **`\begin{}`/`\end{}` の前で自動改行**
- `\begin{}` の後は改行しない設定
- `\end{}` の後も改行しない設定

### その他
- 行末空白の自動削除
- 連続する空行の制限
- 長い行の自動折り返し
- LaTeX環境の構文チェック

## 使用方法

### 基本的な使用方法
1. LaTeXファイルを開く
2. `Ctrl+Shift+I` (Windows/Linux) または `Cmd+Shift+I` (Mac) を押す
3. または右クリックメニューから「LaTeX文書をフォーマット」を選択
4. またはコマンドパレット（`Ctrl+Shift+P`）から「LaTeX文書をフォーマット」を選択

### 保存時の自動フォーマット
設定で `latex-align-indent.formatOnSave` を `true` にすると、保存時に自動的にフォーマットが実行されます。

## 設定オプション

### 基本設定
- `latex-align-indent.formatOnSave`: 保存時の自動フォーマット（デフォルト: false）
- `latex-align-indent.alignEnvironments`: 表組み環境の整列（デフォルト: true）
- `latex-align-indent.indentEnvironments`: 環境のインデント（デフォルト: true）
- `latex-align-indent.indentInsideEnvironments`: 環境内でのインデント（デフォルト: true）

### 中括弧とインデント
- `latex-align-indent.formatBraces`: 中括弧のフォーマット（デフォルト: true）
- `latex-align-indent.breakBeforeEnvironments`: `\begin{}`/`\end{}` の前で改行（デフォルト: false）

### 空白と行処理
- `latex-align-indent.trimTrailingWhitespace`: 行末空白の削除（デフォルト: true）
- `latex-align-indent.maxConsecutiveBlankLines`: 連続空行の最大数（デフォルト: 1）
- `latex-align-indent.preserveBlankLines`: 空行の保持（デフォルト: true）
- `latex-align-indent.maxLineLength`: 最大行長（0で無効、デフォルト: 0）

### TikZ / PGFPlots
- `latex-align-indent.skipTikz`: `tikzpicture` / `pgfplots` 系環境をフォーマットから除外（デフォルト: false）

## 対応環境

### 表組み環境（自動整列対象）
- align / align*
- tabular / tabular*
- array / array*
- alignat / alignat*
- gather / gather*
- multline / multline*
- eqnarray / eqnarray*
- nodisplayskipflalign / nodisplayskipflalign*

### インデント対象
- すべての LaTeX 環境（`\begin{}`/`\end{}`）
- `\foreach` ループの中括弧
- 一般的な複数行中括弧

## 新機能

### v0.0.2 の新機能
- **`\foreach` ループの中括弧内自動インデント**
  ```latex
  \foreach \x in {-15,-14,...,15} {
      \draw[dash pattern=on 0 off .25mm, line cap=round] (\x,-15.25) -- (\x,15.25);
  }
  ```

- **環境前改行の改善**
  - `\begin{}` の前で改行、後では改行しない
  - `\end{}` の前で改行、後では改行しない

## ライセンス

MIT License
