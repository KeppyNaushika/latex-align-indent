import * as vscode from 'vscode';

interface EnvironmentInfo {
    start: number;
    end: number;
    content: string[];
    type: string;
    indent: string;
    beginLine?: number;
    endLine?: number;
}

interface EnvironmentMismatch {
    line: number;
    column: number;
    expected: string;
    actual: string;
    message: string;
}

interface FormatConfig {
    useSpaces: boolean;
    tabSize: number;
    alignEnvironments: boolean;
    indentEnvironments: boolean;
    indentInsideEnvironments: boolean;
    maxLineLength: number;
    preserveBlankLines: boolean;
    maxConsecutiveBlankLines: number;
    trimTrailingWhitespace: boolean;
    formatBraces: boolean;
    breakBeforeEnvironments: boolean;
}

/**
 * 文字列の表示幅を計算（全角文字対応）
 */
function getDisplayWidth(str: string): number {
    let width = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charAt(i);
        if (char.match(/[^\x00-\x7F]/)) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
}

/**
 * インデント文字列を生成
 */
function createIndent(level: number, config: FormatConfig): string {
    if (config.useSpaces) {
        return ' '.repeat(level * config.tabSize);
    } else {
        return '\t'.repeat(level);
    }
}

/**
 * 行末の空白を削除
 */
function trimTrailingWhitespace(lines: string[]): string[] {
    return lines.map(line => line.replace(/\s+$/, ''));
}

/**
 * 連続する空行を制限
 */
function limitConsecutiveBlankLines(lines: string[], maxBlankLines: number): string[] {
    const result: string[] = [];
    let consecutiveBlankLines = 0;
    
    for (const line of lines) {
        if (line.trim() === '') {
            consecutiveBlankLines++;
            if (consecutiveBlankLines <= maxBlankLines) {
                result.push('');
            }
        } else {
            consecutiveBlankLines = 0;
            result.push(line);
        }
    }
    
    return result;
}

interface BraceInfo {
    openLine: number;
    closeLine: number;
    openPos: number;
    closePos: number;
    baseIndent: string;
}

/**
 * 中括弧のペアを検出
 */
function findBracePairs(lines: string[]): BraceInfo[] {
    const braceInfos: BraceInfo[] = [];
    const braceStack: Array<{line: number, pos: number, indent: string}> = [];
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        // コメント行はスキップ
        if (line.trim().startsWith('%')) {
            continue;
        }
        
        for (let pos = 0; pos < line.length; pos++) {
            const char = line[pos];
            
            if (char === '{') {
                // エスケープされた中括弧は無視
                if (pos > 0 && line[pos - 1] === '\\') {
                    continue;
                }
                
                // 開き括弧をスタックにプッシュ
                const indent = line.match(/^(\s*)/)?.[1] || '';
                braceStack.push({line: lineIndex, pos, indent});
                
            } else if (char === '}') {
                // エスケープされた中括弧は無視
                if (pos > 0 && line[pos - 1] === '\\') {
                    continue;
                }
                
                // 対応する開き括弧を探す
                if (braceStack.length > 0) {
                    const openBrace = braceStack.pop()!;
                    
                    // 複数行にわたる中括弧のみを処理対象とする
                    if (openBrace.line !== lineIndex) {
                        braceInfos.push({
                            openLine: openBrace.line,
                            closeLine: lineIndex,
                            openPos: openBrace.pos,
                            closePos: pos,
                            baseIndent: openBrace.indent
                        });
                    }
                }
            }
        }
    }
    
    return braceInfos;
}

/**
 * 中括弧のフォーマット
 */
function formatBraces(lines: string[], config: FormatConfig): string[] {
    const result = [...lines];
    
    // 基本的な中括弧の前後スペース調整
    for (let i = 0; i < result.length; i++) {
        let line = result[i];
        
        // コメント行はそのまま
        if (line.trim().startsWith('%')) {
            continue;
        }
        
        // 中括弧の前後にスペースを調整
        line = line.replace(/\\([a-zA-Z]+)\s*\{/g, '\\$1{');
        line = line.replace(/\s+\}/g, '}');
        line = line.replace(/\{\s+([^\s])/g, '{$1');
        
        result[i] = line;
    }
    
    // 複数行中括弧のインデント処理
    const braceInfos = findBracePairs(result);
    
    // 後ろから処理して行番号のズレを防ぐ
    for (const braceInfo of braceInfos.reverse()) {
        const {openLine, closeLine, openPos, closePos, baseIndent} = braceInfo;
        
        // 開き括弧の行をチェック - 括弧で終わっているか
        const openLineText = result[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '';
        
        // 閉じ括弧の行をチェック - 括弧で始まっているか
        const closeLineText = result[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        // 両方の条件を満たす場合のみインデント処理を実行
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            // 中括弧内の行をインデント
            for (let i = openLine + 1; i < closeLine; i++) {
                const line = result[i];
                const trimmed = line.trim();
                
                if (trimmed !== '') {
                    const innerIndent = createIndent(1, config);
                    result[i] = baseIndent + innerIndent + trimmed;
                } else {
                    result[i] = '';
                }
            }
            
            // 閉じ括弧を適切な位置に配置
            result[closeLine] = baseIndent + '}';
        }
    }
    
    return result;
}

/**
 * 表組み環境の行を整列
 */
function alignTabular(lines: string[], config: FormatConfig): string[] {
    const maxLengths: number[] = [];
    const rows: string[][] = [];
    const lineTypes: string[] = [];

    // 各行を解析
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
            lineTypes.push('empty');
            rows.push([]);
            continue;
        }
        
        if (trimmedLine.startsWith('%')) {
            lineTypes.push('comment');
            rows.push([]);
            continue;
        }
        
        if (!trimmedLine.includes('&')) {
            lineTypes.push('other');
            rows.push([]);
            continue;
        }
        
        lineTypes.push('data');
        const cells = line.split('&').map(cell => cell.replace(/\s+$/, ''));
        const lengths = cells.map(cell => getDisplayWidth(cell));
        rows.push(cells);

        while (maxLengths.length < lengths.length) {
            maxLengths.push(0);
        }
        
        for (let i = 0; i < lengths.length; i++) {
            maxLengths[i] = Math.max(maxLengths[i], lengths[i]);
        }
    }

    // 整列された行を生成
    const alignedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const lineType = lineTypes[i];
        
        if (lineType === 'empty') {
            alignedLines.push('');
            continue;
        }
        
        if (lineType === 'comment' || lineType === 'other') {
            const trimmed = lines[i].trim();
            if (config.indentInsideEnvironments && trimmed) {
                alignedLines.push(createIndent(1, config) + trimmed);
            } else {
                alignedLines.push(lines[i]);
            }
            continue;
        }
        
        if (lineType === 'data') {
            const cells = rows[i];
            const alignedCells: string[] = [];
            
            for (let j = 0; j < cells.length; j++) {
                const cell = cells[j];
                const currentWidth = getDisplayWidth(cell);
                const padding = maxLengths[j] - currentWidth;
                const alignedCell = cell + ' '.repeat(Math.max(0, padding));
                alignedCells.push(alignedCell);
            }
            
            let alignedLine = alignedCells.join(' &');
            
            if (config.indentInsideEnvironments) {
                alignedLine = createIndent(1, config) + alignedLine;
            }
            
            alignedLines.push(alignedLine);
        }
    }

    return alignedLines;
}

/**
 * LaTeX環境を検出し、不整合もチェック
 */
function findEnvironments(document: vscode.TextDocument | {getText(): string}): {environments: EnvironmentInfo[], mismatches: EnvironmentMismatch[]} {
    const text = document.getText();
    const lines = text.split('\n');
    const environments: EnvironmentInfo[] = [];
    const mismatches: EnvironmentMismatch[] = [];
    
    const generalEnvPattern = /^(\s*)\\begin\{([^}]+)\}/;
    const endPattern = /^(\s*)\\end\{([^}]+)\}/;
    
    const envStack: Array<{type: string, start: number, indent: string, beginLine: number}> = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // コメント行はスキップ
        if (line.trim().startsWith('%')) {
            continue;
        }
        
        // \begin{環境}の検出
        let match = line.match(generalEnvPattern);
        if (match) {
            const indent = match[1];
            const envType = match[2];
            envStack.push({type: envType, start: i, indent, beginLine: i});
            continue;
        }
        
        // \end{環境}の検出
        match = line.match(endPattern);
        if (match) {
            const endEnvType = match[2];
            
            if (envStack.length === 0) {
                // 対応する\beginがない\end
                const column = line.indexOf('\\end');
                mismatches.push({
                    line: i,
                    column,
                    expected: '',
                    actual: endEnvType,
                    message: `Unmatched \\end{${endEnvType}} - no corresponding \\begin found`
                });
                continue;
            }
            
            const lastEnv = envStack[envStack.length - 1];
            
            if (lastEnv.type === endEnvType) {
                // 正しくマッチした環境
                const env = envStack.pop()!;
                const content: string[] = [];
                
                for (let j = env.start + 1; j < i; j++) {
                    content.push(lines[j]);
                }
                
                environments.push({
                    start: env.start + 1,
                    end: i - 1,
                    content,
                    type: env.type,
                    indent: env.indent,
                    beginLine: env.beginLine,
                    endLine: i
                });
            } else {
                // 環境の不整合
                const column = line.indexOf('\\end');
                mismatches.push({
                    line: i,
                    column,
                    expected: lastEnv.type,
                    actual: endEnvType,
                    message: `Environment mismatch: expected \\end{${lastEnv.type}} but found \\end{${endEnvType}}`
                });
                
                // スタックから正しい環境を探して削除
                for (let j = envStack.length - 1; j >= 0; j--) {
                    if (envStack[j].type === endEnvType) {
                        envStack.splice(j, 1);
                        break;
                    }
                }
            }
        }
    }
    
    // 未閉じの環境をチェック
    for (const unclosedEnv of envStack) {
        const line = lines[unclosedEnv.beginLine];
        const column = line.indexOf('\\begin');
        mismatches.push({
            line: unclosedEnv.beginLine,
            column,
            expected: `\\end{${unclosedEnv.type}}`,
            actual: '',
            message: `Unclosed environment: \\begin{${unclosedEnv.type}} is not closed`
        });
    }
    
    return {environments, mismatches};
}

/**
 * \begin{}と\end{}の前で自動改行
 */
function breakBeforeEnvironments(lines: string[], config: FormatConfig): string[] {
    if (!config.breakBeforeEnvironments) {
        return lines;
    }
    
    const result: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // コメント行はそのまま
        if (line.trim().startsWith('%')) {
            result.push(line);
            continue;
        }
        
        // \begin{環境}や\end{環境}を含む行を処理
        const beginPattern = /(.*?)\\begin\{([^}]+)\}(.*)/;
        const endPattern = /(.*?)\\end\{([^}]+)\}(.*)/;
        
        let currentLine = line;
        let hasChanges = false;
        
        // \begin{}の前後で改行
        const beginMatch = currentLine.match(beginPattern);
        if (beginMatch) {
            const [, before, envType, after] = beginMatch;
            const indent = line.match(/^(\s*)/)?.[1] || '';
            
            if (before.trim()) {
                // \begin{}の前にコンテンツがある場合
                result.push(before.trimEnd());
                currentLine = indent + `\\begin{${envType}}` + after;
                hasChanges = true;
            }
            
            if (after.trim()) {
                // \begin{}の後にコンテンツがある場合
                result.push(indent + `\\begin{${envType}}`);
                currentLine = indent + createIndent(1, config) + after.trim();
                hasChanges = true;
            }
        }
        
        // \end{}の前後で改行
        const endMatch = currentLine.match(endPattern);
        if (endMatch) {
            const [, before, envType, after] = endMatch;
            const indent = line.match(/^(\s*)/)?.[1] || '';
            
            if (before.trim()) {
                // \end{}の前にコンテンツがある場合
                result.push(before.trimEnd());
                currentLine = indent + `\\end{${envType}}` + after;
                hasChanges = true;
            }
            
            if (after.trim()) {
                // \end{}の後にコンテンツがある場合
                result.push(indent + `\\end{${envType}}`);
                currentLine = after.trim();
                hasChanges = true;
            }
        }
        
        if (!hasChanges) {
            result.push(line);
        } else {
            result.push(currentLine);
        }
    }
    
    return result;
}

/**
 * \begin{}\end{}環境のインデント処理
 */
function formatEnvironmentIndentation(lines: string[], config: FormatConfig): string[] {
    const result = [...lines];
    
    const tempDocument = {
        getText: () => result.join('\n')
    };
    
    const {environments} = findEnvironments(tempDocument);
    
    // 後ろから処理して行番号のズレを防ぐ
    for (const env of environments.reverse()) {
        if (env.beginLine === undefined || env.endLine === undefined) continue;
        
        const beginLine = result[env.beginLine];
        const endLine = result[env.endLine];
        
        // \begin{}で終わり、\end{}で始まるかチェック
        const beginMatch = beginLine.match(/^(\s*)\\begin\{[^}]+\}(.*)$/);
        const endMatch = endLine.match(/^(\s*)\\end\{[^}]+\}(.*)$/);
        
        if (!beginMatch || !endMatch) continue;
        
        const afterBegin = beginMatch[2].trim();
        const beforeEnd = endMatch[1];
        
        // \begin{}で終わり、\end{}が独立行にある場合のみ処理
        if (afterBegin === '' && beforeEnd.trim() === '') {
            const baseIndent = beginMatch[1];
            
            // 環境内の行をインデント
            for (let i = env.beginLine + 1; i < env.endLine; i++) {
                const line = result[i];
                const trimmed = line.trim();
                
                if (trimmed !== '' && !trimmed.startsWith('%')) {
                    const innerIndent = createIndent(1, config);
                    result[i] = baseIndent + innerIndent + trimmed;
                } else if (trimmed === '') {
                    result[i] = '';
                } else {
                    // コメント行はインデントのみ調整
                    result[i] = baseIndent + createIndent(1, config) + trimmed;
                }
            }
            
            // \end{}を適切な位置に配置
            result[env.endLine] = baseIndent + endLine.trim();
        }
    }
    
    return result;
}

/**
 * 基本的なLaTeXインデント処理
 */
function applyBasicIndentation(lines: string[], config: FormatConfig): string[] {
    const result: string[] = [];
    let indentLevel = 0;
    
    const beginPattern = /^(\s*)\\begin\{([^}]+)\}/;
    const endPattern = /^(\s*)\\end\{([^}]+)\}/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 空行の処理
        if (!trimmed) {
            if (config.preserveBlankLines) {
                result.push('');
            }
            continue;
        }
        
        // コメント行はインデントのみ適用
        if (trimmed.startsWith('%')) {
            if (indentLevel > 0) {
                result.push(createIndent(indentLevel, config) + trimmed);
            } else {
                result.push(line);
            }
            continue;
        }
        
        let currentIndent = indentLevel;
        
        // \end{}の場合、インデントを減らす
        if (endPattern.test(trimmed)) {
            currentIndent = Math.max(0, indentLevel - 1);
            indentLevel = currentIndent;
        }
        
        // インデントを適用
        const indentedLine = createIndent(currentIndent, config) + trimmed;
        result.push(indentedLine);
        
        // \begin{}の場合、次行からインデントを増やす
        if (beginPattern.test(trimmed)) {
            indentLevel = currentIndent + 1;
        }
    }
    
    return result;
}

/**
 * 長い行の折り返し処理
 */
function wrapLongLines(lines: string[], maxLength: number): string[] {
    if (maxLength <= 0) return lines;
    
    const result: string[] = [];
    
    for (const line of lines) {
        if (line.length <= maxLength || line.trim().startsWith('%')) {
            result.push(line);
            continue;
        }
        
        // 数式環境内や表組み環境では折り返さない
        if (line.includes('&') || line.includes('\\\\') || line.includes('$$')) {
            result.push(line);
            continue;
        }
        
        // インデント部分を保持
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const content = line.substring(indent.length);
        
        // 単語境界で折り返し
        const words = content.split(/(\s+)/);
        let currentLine = indent;
        let currentLength = indent.length;
        
        for (const word of words) {
            if (currentLength + word.length <= maxLength) {
                currentLine += word;
                currentLength += word.length;
            } else if (currentLine.trim()) {
                result.push(currentLine);
                currentLine = indent + word;
                currentLength = indent.length + word.length;
            } else {
                result.push(indent + word);
                currentLine = indent;
                currentLength = indent.length;
            }
        }
        
        if (currentLine.trim()) {
            result.push(currentLine);
        }
    }
    
    return result;
}

/**
 * 設定を取得
 */
function getFormatConfig(): FormatConfig {
    const config = vscode.workspace.getConfiguration('latex-align-indent');
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const latexConfig = vscode.workspace.getConfiguration('[latex]');
    
    const latexTabSize = latexConfig.get<number>('editor.tabSize');
    const defaultTabSize = editorConfig.get<number>('tabSize', 4);
    
    return {
        useSpaces: editorConfig.get<boolean>('insertSpaces', true),
        tabSize: latexTabSize || defaultTabSize,
        alignEnvironments: config.get<boolean>('alignEnvironments', true),
        indentEnvironments: config.get<boolean>('indentEnvironments', true),
        indentInsideEnvironments: config.get<boolean>('indentInsideEnvironments', true),
        maxLineLength: config.get<number>('maxLineLength', 0),
        preserveBlankLines: config.get<boolean>('preserveBlankLines', true),
        maxConsecutiveBlankLines: config.get<number>('maxConsecutiveBlankLines', 1),
        trimTrailingWhitespace: config.get<boolean>('trimTrailingWhitespace', true),
        formatBraces: config.get<boolean>('formatBraces', true),
        breakBeforeEnvironments: config.get<boolean>('breakBeforeEnvironments', false)
    };
}

/**
 * LaTeX文書の完全フォーマット
 */
async function formatLaTeXDocument(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('アクティブなエディタがありません');
        return;
    }

    const document = editor.document;
    if (!document.fileName.endsWith('.tex')) {
        vscode.window.showErrorMessage('LaTeXファイルではありません');
        return;
    }

    const config = getFormatConfig();
    const originalSelections = [...editor.selections];
    const visibleRanges = [...editor.visibleRanges];

    try {
        const text = document.getText();
        let lines = text.split('\n');
        
        // 1. 行末空白の削除
        if (config.trimTrailingWhitespace) {
            lines = trimTrailingWhitespace(lines);
        }
        
        // 2. 連続する空行の制限
        if (config.maxConsecutiveBlankLines >= 0) {
            lines = limitConsecutiveBlankLines(lines, config.maxConsecutiveBlankLines);
        }
        
        // 3. 環境の自動改行
        if (config.breakBeforeEnvironments) {
            lines = breakBeforeEnvironments(lines, config);
        }
        
        // 4. 中括弧のフォーマット
        if (config.formatBraces) {
            lines = formatBraces(lines, config);
        }
        
        // 5. 表組み環境の整列
        if (config.alignEnvironments) {
            const tempDocument = {
                getText: () => lines.join('\n')
            } as vscode.TextDocument;
            
            const {environments} = findEnvironments(tempDocument);
            const tableEnvTypes = ['align', 'align*', 'tabular', 'tabular*', 'array', 'array*', 
                                 'alignat', 'alignat*', 'gather', 'gather*', 'multline', 'multline*',
                                 'nodisplayskipflalign', 'nodisplayskipflalign*', 'eqnarray', 'eqnarray*'];
            
            for (const env of environments.reverse()) {
                if (tableEnvTypes.includes(env.type)) {
                    const alignedContent = alignTabular(env.content, config);
                    lines.splice(env.start, env.end - env.start + 1, ...alignedContent);
                }
            }
        }
        
        // 6. 環境のインデント処理
        if (config.indentEnvironments) {
            lines = formatEnvironmentIndentation(lines, config);
        }
        
        // 7. 基本的なインデント処理
        if (config.indentEnvironments) {
            lines = applyBasicIndentation(lines, config);
        }
        
        // 8. 長い行の折り返し
        if (config.maxLineLength > 0) {
            lines = wrapLongLines(lines, config.maxLineLength);
        }
        
        const newContent = lines.join('\n');
        
        // ドキュメント全体を置換
        await editor.edit((editBuilder: vscode.TextEditorEdit) => {
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );
            editBuilder.replace(fullRange, newContent);
        });

        // カーソル位置とスクロール位置を復元
        editor.selections = originalSelections;
        if (visibleRanges.length > 0) {
            editor.revealRange(visibleRanges[0], vscode.TextEditorRevealType.InCenter);
        }

        vscode.window.showInformationMessage('LaTeX文書のフォーマットが完了しました');

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`エラーが発生しました: ${message}`);
        console.error('LaTeX format error:', error);
    }
}

/**
 * 同期的なフォーマット（保存前処理用）
 */
async function formatLaTeXDocumentSync(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    const config = getFormatConfig();
    
    try {
        const text = document.getText();
        let lines = text.split('\n');
        
        // フォーマット処理を実行
        if (config.trimTrailingWhitespace) {
            lines = trimTrailingWhitespace(lines);
        }
        
        if (config.maxConsecutiveBlankLines >= 0) {
            lines = limitConsecutiveBlankLines(lines, config.maxConsecutiveBlankLines);
        }
        
        if (config.breakBeforeEnvironments) {
            lines = breakBeforeEnvironments(lines, config);
        }
        
        if (config.formatBraces) {
            lines = formatBraces(lines, config);
        }
        
        if (config.alignEnvironments) {
            const tempDocument = {
                getText: () => lines.join('\n')
            } as vscode.TextDocument;
            
            const {environments} = findEnvironments(tempDocument);
            const tableEnvTypes = ['align', 'align*', 'tabular', 'tabular*', 'array', 'array*', 
                                 'alignat', 'alignat*', 'gather', 'gather*', 'multline', 'multline*',
                                 'nodisplayskipflalign', 'nodisplayskipflalign*', 'eqnarray', 'eqnarray*'];
            
            for (const env of environments.reverse()) {
                if (tableEnvTypes.includes(env.type)) {
                    const alignedContent = alignTabular(env.content, config);
                    lines.splice(env.start, env.end - env.start + 1, ...alignedContent);
                }
            }
        }
        
        if (config.indentEnvironments) {
            lines = formatEnvironmentIndentation(lines, config);
        }
        
        if (config.indentEnvironments) {
            lines = applyBasicIndentation(lines, config);
        }
        
        if (config.maxLineLength > 0) {
            lines = wrapLongLines(lines, config.maxLineLength);
        }
        
        const newContent = lines.join('\n');
        
        // TextEditとして返す
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        
        return [vscode.TextEdit.replace(fullRange, newContent)];
        
    } catch (error) {
        console.error('LaTeX format error:', error);
        return [];
    }
}

/**
 * LaTeX診断プロバイダー
 */
class LaTeXDiagnosticProvider {
    private diagnostics: vscode.DiagnosticCollection;
    
    constructor() {
        this.diagnostics = vscode.languages.createDiagnosticCollection('latex-align-indent');
    }
    
    public updateDiagnostics(document: vscode.TextDocument): void {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            const {mismatches} = findEnvironments(document);
            
            for (const mismatch of mismatches) {
                const line = document.lineAt(mismatch.line);
                const startPos = new vscode.Position(mismatch.line, mismatch.column);
                const endPos = new vscode.Position(mismatch.line, line.text.length);
                const range = new vscode.Range(startPos, endPos);
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    mismatch.message,
                    vscode.DiagnosticSeverity.Warning
                );
                
                diagnostic.source = 'LaTeX Align Indent';
                diagnostic.code = 'environment-mismatch';
                
                diagnostics.push(diagnostic);
            }
            
            this.diagnostics.set(document.uri, diagnostics);
        } catch (error) {
            console.error('LaTeX diagnostic error:', error);
        }
    }
    
    public clear(): void {
        this.diagnostics.clear();
    }
    
    public dispose(): void {
        this.diagnostics.dispose();
    }
}

/**
 * VSCodeのフォーマッタープロバイダー
 */
class LaTeXFormattingProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
    async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        console.log('LaTeX Align Indent: Document formatting requested for:', document.fileName);
        console.log('Document language ID:', document.languageId);
        
        try {
            const edits = await formatLaTeXDocumentSync(document);
            console.log('LaTeX Align Indent: Formatting completed, edits:', edits.length);
            return edits;
        } catch (error) {
            console.error('LaTeX Align Indent: Formatting error:', error);
            vscode.window.showErrorMessage(`フォーマットエラー: ${error}`);
            return [];
        }
    }
    
    async provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        console.log('LaTeX Align Indent: Range formatting requested for:', document.fileName);
        return await this.provideDocumentFormattingEdits(document, options, token);
    }
}

/**
 * 保存時の自動フォーマット
 */
function setupAutoFormat(context: vscode.ExtensionContext): void {
    const saveDisposable = vscode.workspace.onWillSaveTextDocument((event: vscode.TextDocumentWillSaveEvent) => {
        if (event.document.languageId === 'latex') {
            const config = vscode.workspace.getConfiguration('latex-align-indent');
            if (config.get<boolean>('formatOnSave', false)) {
                // 保存前に同期的にフォーマットを実行
                event.waitUntil(formatLaTeXDocumentSync(event.document));
            }
        }
    });
    context.subscriptions.push(saveDisposable);
}

/**
 * 拡張機能の活性化
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('LaTeX Align Indent extension is being activated');

    // 診断プロバイダーを作成
    const diagnosticProvider = new LaTeXDiagnosticProvider();

    // フォーマットコマンドを登録
    const formatCommand = vscode.commands.registerCommand(
        'latex-align-indent.formatDocument',
        formatLaTeXDocument
    );
    
    // 複数の言語識別子でフォーマッタープロバイダーを登録
    const latexSelectors = [
        { scheme: 'file', language: 'latex' },
        { scheme: 'file', language: 'tex' },
        { pattern: '**/*.tex' },
        { pattern: '**/*.latex' },
        { pattern: '**/*.ltx' }
    ];
    
    const formatProviders: vscode.Disposable[] = [];
    
    for (const selector of latexSelectors) {
        // ドキュメント全体フォーマット
        const documentProvider = vscode.languages.registerDocumentFormattingEditProvider(
            selector,
            new LaTeXFormattingProvider()
        );
        
        // 範囲フォーマット
        const rangeProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
            selector,
            new LaTeXFormattingProvider()
        );
        
        formatProviders.push(documentProvider, rangeProvider);
    }
    
    // 診断の更新イベントを設定
    const diagnosticUpdateEvents = [
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.languageId === 'latex' || document.fileName.endsWith('.tex')) {
                diagnosticProvider.updateDiagnostics(document);
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === 'latex' || event.document.fileName.endsWith('.tex')) {
                diagnosticProvider.updateDiagnostics(event.document);
            }
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === 'latex' || document.fileName.endsWith('.tex')) {
                diagnosticProvider.updateDiagnostics(document);
            }
        }),
        vscode.workspace.onDidCloseTextDocument(() => {
            // 必要に応じて特定のドキュメントの診断をクリア
        })
    ];
    
    // 現在開いているLaTeXドキュメントに対して診断を実行
    vscode.workspace.textDocuments.forEach((document) => {
        if (document.languageId === 'latex' || document.fileName.endsWith('.tex')) {
            diagnosticProvider.updateDiagnostics(document);
        }
    });
    
    context.subscriptions.push(
        formatCommand,
        diagnosticProvider,
        ...formatProviders,
        ...diagnosticUpdateEvents
    );

    // 保存時の自動処理を設定
    setupAutoFormat(context);

    console.log('LaTeX Align Indent extension is now active!');
    console.log('Registered formatters for:', latexSelectors);
    
    // アクティベーション確認
    vscode.window.showInformationMessage('LaTeX Align Indent が正常にアクティブになりました');
}

/**
 * 拡張機能の非活性化
 */
export function deactivate(): void {
    console.log('LaTeX Align Indent extension is being deactivated');
}