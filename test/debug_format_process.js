// Debug the actual formatting process using TypeScript logic
const fs = require('fs');

// Copy exact TypeScript formatting logic
function createIndent(level, config) {
    if (config.useSpaces) {
        return ' '.repeat(level * config.tabSize);
    } else {
        return '\t'.repeat(level);
    }
}

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
    
    console.log('Found brace pairs:', braceInfos.length);
    braceInfos.forEach((info, i) => {
        console.log(`  Pair ${i + 1}: lines ${info.openLine + 1}-${info.closeLine + 1}`);
    });
    
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
        
        console.log(`Pair ${openLine + 1}-${closeLine + 1}:`);
        console.log(`  After open brace: "${afterBrace}"`);
        console.log(`  Before close brace: "${beforeBrace}"`);
        console.log(`  Should process: ${isOpenLineEndsWithBrace && isCloseLineStartsWithBrace}`);
        
        // 両方の条件を満たす場合のみネストレベルを増加
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            for (let i = openLine + 1; i < closeLine; i++) {
                lineNestLevels[i]++;
            }
        }
    }
    
    console.log('Line nest levels (first 20):', lineNestLevels.slice(0, 20));
    
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
            console.log(`Processing brace pair ${openLine + 1}-${closeLine + 1}`);
            
            // 中括弧内の行をインデント
            for (let i = openLine + 1; i < closeLine; i++) {
                const line = result[i];
                const trimmed = line.trim();
                
                if (trimmed !== '') {
                    const nestLevel = lineNestLevels[i];
                    const innerIndent = createIndent(nestLevel, config);
                    const newLine = baseIndent + innerIndent + trimmed;
                    console.log(`  Line ${i + 1} (nest ${nestLevel}): "${line}" -> "${newLine}"`);
                    result[i] = newLine;
                } else {
                    result[i] = '';
                }
            }
            
            // 閉じ括弧を適切な位置に配置
            const closeBraceAfter = closeLineText.substring(closePos + 1);
            const newCloseLine = baseIndent + '}' + closeBraceAfter;
            console.log(`  Close line: "${closeLineText}" -> "${newCloseLine}"`);
            result[closeLine] = newCloseLine;
        }
    }
    
    return result;
}

// Test configuration matching VS Code defaults
const config = {
    useSpaces: true,
    tabSize: 4,
    formatBraces: true
};

console.log('=== TESTING TYPESCRIPT FORMATTING LOGIC ===');

// Test on the unindented file
const content = fs.readFileSync('/Users/keppy/dev/latex-align-indent/unindented_test.tex', 'utf8');
const lines = content.split('\n');

console.log('Original file has', lines.length, 'lines');
console.log('First 10 lines:');
lines.slice(0, 10).forEach((line, i) => {
    console.log(`  ${i + 1}: "${line}"`);
});

const formatted = formatBraces(lines, config);

console.log('\nFirst 15 lines after formatting:');
formatted.slice(0, 15).forEach((line, i) => {
    console.log(`  ${i + 1}: "${line}"`);
});

// Write result
fs.writeFileSync('/Users/keppy/dev/latex-align-indent/ts_logic_test_result.tex', formatted.join('\n'));
console.log('\nResult written to ts_logic_test_result.tex');