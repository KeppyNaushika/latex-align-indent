// Test the complete TypeScript implementation
const fs = require('fs');

// Copy ALL functions from extension.ts exactly as they are

/**
 * 文字列の表示幅を計算（全角文字対応）
 */
function getDisplayWidth(str) {
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
function createIndent(level, config) {
    if (config.useSpaces) {
        return ' '.repeat(level * config.tabSize);
    } else {
        return '\t'.repeat(level);
    }
}

/**
 * 行末の空白を削除
 */
function trimTrailingWhitespace(lines) {
    return lines.map(line => line.replace(/\s+$/, ''));
}

/**
 * 連続する空行を制限
 */
function limitConsecutiveBlankLines(lines, maxBlankLines) {
    const result = [];
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

/**
 * 中括弧のペアを検出
 */
function findBracePairs(lines) {
    const braceInfos = [];
    const braceStack = [];
    
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
                    // ただし、\foreachなどのコマンドの中括弧は処理対象とする
                    const beforeBrace = line.substring(0, pos);
                    if (!beforeBrace.match(/\\(foreach|pgffor|for)\s*$/)) {
                        continue;
                    }
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
                    const openBrace = braceStack.pop();
                    
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
function formatBraces(lines, config) {
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
    
    // ネストレベルを計算するために中括弧ペアを開始行でソート
    braceInfos.sort((a, b) => a.openLine - b.openLine);
    
    // 各行のネストレベルを計算
    const lineNestLevels = new Array(result.length).fill(0);
    
    for (const braceInfo of braceInfos) {
        const {openLine, closeLine, openPos, closePos} = braceInfo;
        
        // 開き括弧の行をチェック - 括弧で終わっているか（バックスラッシュも考慮）
        const openLineText = result[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
        
        // 閉じ括弧の行をチェック - 括弧で始まっているか
        const closeLineText = result[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        // 両方の条件を満たす場合のみネストレベルを増加
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            for (let i = openLine + 1; i < closeLine; i++) {
                lineNestLevels[i]++;
            }
        }
    }
    
    // ネストレベルに基づいてインデントを適用
    for (const braceInfo of braceInfos.reverse()) {
        const {openLine, closeLine, openPos, closePos, baseIndent} = braceInfo;
        
        // 開き括弧の行をチェック - 括弧で終わっているか（バックスラッシュも考慮）
        const openLineText = result[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
        
        // 閉じ括弧の行をチェック - 括弧で始まっているか
        const closeLineText = result[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        // 両方の条件を満たす場合のみインデント処理を実行
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            console.log(`formatBraces: Processing pair ${openLine + 1}-${closeLine + 1}`);
            
            // 中括弧内の行をインデント
            for (let i = openLine + 1; i < closeLine; i++) {
                const line = result[i];
                const trimmed = line.trim();
                
                if (trimmed !== '') {
                    const nestLevel = lineNestLevels[i];
                    const innerIndent = createIndent(nestLevel, config);
                    result[i] = innerIndent + trimmed;
                    console.log(`  formatBraces: Line ${i + 1} (nest ${nestLevel}) -> "${result[i]}"`);
                } else {
                    result[i] = '';
                }
            }
            
            // 閉じ括弧を適切な位置に配置
            const closeBraceAfter = closeLineText.substring(closePos + 1);
            result[closeLine] = '}' + closeBraceAfter;
        }
    }
    
    return result;
}

/**
 * 表組み環境の行を整列
 */
function alignTabular(lines, config) {
    // Simplified version - just apply indentation if needed
    const result = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed !== '' && config.indentInsideEnvironments) {
            result.push(createIndent(1, config) + trimmed);
        } else {
            result.push(line);
        }
    }
    return result;
}

/**
 * LaTeX環境を検出
 */
function findEnvironments(document) {
    const text = document.getText();
    const lines = text.split('\n');
    const environments = [];
    const mismatches = [];
    
    const generalEnvPattern = /^(\s*)\\begin\{([^}]+)\}/;
    const endPattern = /^(\s*)\\end\{([^}]+)\}/;
    
    const envStack = [];
    
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
            
            if (envStack.length > 0) {
                const lastEnv = envStack[envStack.length - 1];
                
                if (lastEnv.type === endEnvType) {
                    // 正しくマッチした環境
                    const env = envStack.pop();
                    const content = [];
                    
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
                }
            }
        }
    }
    
    return {environments, mismatches};
}

/**
 * \begin{}と\end{}の前で自動改行
 */
function breakBeforeEnvironments(lines, config) {
    if (!config.breakBeforeEnvironments) {
        return lines;
    }
    
    // Simplified implementation - just return as is for testing
    return lines;
}

/**
 * \begin{}\end{}環境のインデント処理
 */
function formatEnvironmentIndentation(lines, config) {
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
            
            console.log(`formatEnvironmentIndentation: Processing env ${env.beginLine + 1}-${env.endLine + 1}`);
            
            // 環境内の行をインデント
            for (let i = env.beginLine + 1; i < env.endLine; i++) {
                const line = result[i];
                const trimmed = line.trim();
                
                if (trimmed !== '' && !trimmed.startsWith('%')) {
                    const innerIndent = createIndent(1, config);
                    result[i] = baseIndent + innerIndent + trimmed;
                    console.log(`  formatEnvironmentIndentation: Line ${i + 1} -> "${result[i]}"`);
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
function applyBasicIndentation(lines, config) {
    const result = [];
    let indentLevel = 0;
    
    const beginPattern = /^(\s*)\\begin\{([^}]+)\}/;
    const endPattern = /^(\s*)\\end\{([^}]+)\}/;
    
    console.log('applyBasicIndentation: Starting...');
    
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
                const newLine = createIndent(indentLevel, config) + trimmed;
                console.log(`  applyBasicIndentation: Comment line ${i + 1} -> "${newLine}"`);
                result.push(newLine);
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
        console.log(`  applyBasicIndentation: Line ${i + 1} -> "${indentedLine}"`);
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
function wrapLongLines(lines, maxLength) {
    if (maxLength <= 0) return lines;
    // Simplified - just return as is
    return lines;
}

/**
 * 同期的なフォーマット（完全版）
 */
async function formatLaTeXDocumentSync(document) {
    const config = {
        useSpaces: true,
        tabSize: 4,
        alignEnvironments: true,
        indentEnvironments: true,
        indentInsideEnvironments: true,
        maxLineLength: 0,
        preserveBlankLines: true,
        maxConsecutiveBlankLines: 1,
        trimTrailingWhitespace: true,
        formatBraces: true,
        breakBeforeEnvironments: false
    };
    
    try {
        const text = document.getText();
        let lines = text.split('\n');
        
        console.log('=== FULL TYPESCRIPT IMPLEMENTATION TEST ===');
        console.log('Original lines:');
        lines.forEach((line, i) => console.log(`  ${i + 1}: "${line}"`));
        
        // 1. 行末空白の削除
        console.log('\n=== STEP 1: trimTrailingWhitespace ===');
        if (config.trimTrailingWhitespace) {
            lines = trimTrailingWhitespace(lines);
        }
        
        // 2. 連続する空行の制限
        console.log('\n=== STEP 2: limitConsecutiveBlankLines ===');
        if (config.maxConsecutiveBlankLines >= 0) {
            lines = limitConsecutiveBlankLines(lines, config.maxConsecutiveBlankLines);
        }
        
        // 3. 環境の自動改行
        console.log('\n=== STEP 3: breakBeforeEnvironments ===');
        if (config.breakBeforeEnvironments) {
            lines = breakBeforeEnvironments(lines, config);
        }
        
        // 4. 中括弧のフォーマット
        console.log('\n=== STEP 4: formatBraces ===');
        if (config.formatBraces) {
            lines = formatBraces(lines, config);
        }
        
        console.log('After formatBraces:');
        lines.forEach((line, i) => console.log(`  ${i + 1}: "${line}"`));
        
        // 5. 表組み環境の整列
        console.log('\n=== STEP 5: alignEnvironments ===');
        if (config.alignEnvironments) {
            const tempDocument = {
                getText: () => lines.join('\n')
            };
            
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
        console.log('\n=== STEP 6: formatEnvironmentIndentation ===');
        if (config.indentEnvironments) {
            lines = formatEnvironmentIndentation(lines, config);
        }
        
        console.log('After formatEnvironmentIndentation:');
        lines.forEach((line, i) => console.log(`  ${i + 1}: "${line}"`));
        
        // 7. 基本的なインデント処理 (formatBracesが有効な場合はスキップ)
        console.log('\n=== STEP 7: applyBasicIndentation ===');
        console.log('config.indentEnvironments:', config.indentEnvironments);
        console.log('config.formatBraces:', config.formatBraces);
        console.log('Should run applyBasicIndentation:', config.indentEnvironments && !config.formatBraces);
        
        if (config.indentEnvironments && !config.formatBraces) {
            lines = applyBasicIndentation(lines, config);
        } else {
            console.log('Skipping applyBasicIndentation');
        }
        
        // 8. 長い行の折り返し
        console.log('\n=== STEP 8: wrapLongLines ===');
        if (config.maxLineLength > 0) {
            lines = wrapLongLines(lines, config.maxLineLength);
        }
        
        const newContent = lines.join('\n');
        
        console.log('\n=== FINAL RESULT ===');
        lines.forEach((line, i) => console.log(`${i + 1}: "${line}"`));
        
        return [{
            range: { start: 0, end: text.length },
            newText: newContent
        }];
        
    } catch (error) {
        console.error('LaTeX format error:', error);
        return [];
    }
}

// Test with actual problem case
const testContent = `\\documentclass{article}
\\usepackage{tikz}

\\begin{document}

\\foreach \\x in {-15,-14,...,15} {
\\draw[dash pattern=on 0 off .25mm, line cap=round] (\\x,-15.25) -- (\\x,15.25);
}\\

\\newcommand{\\drawInCoordinatePlane}[7]{
% #1: fx (関数の式、例: \\x+2)
% #2: x_min
% #3: x_max
content here
more content
}\\

\\end{document}`;

const mockDocument = {
    getText: () => testContent
};

formatLaTeXDocumentSync(mockDocument);