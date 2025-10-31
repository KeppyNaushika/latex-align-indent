// Debug the actual execution flow
const fs = require('fs');

// Reproduce the EXACT execution from extension.ts
function createIndent(level, config) {
    console.log(`createIndent called with level=${level}, tabSize=${config.tabSize}`);
    if (config.useSpaces) {
        const result = ' '.repeat(level * config.tabSize);
        console.log(`  returning "${result}" (length: ${result.length})`);
        return result;
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
    console.log('=== formatBraces: START ===');
    const result = [...lines];
    
    console.log('Input lines:');
    result.forEach((line, i) => console.log(`  ${i + 1}: "${line}"`));
    
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
    console.log(`Found ${braceInfos.length} brace pairs`);
    
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
        
        console.log(`Brace pair ${openLine + 1}-${closeLine + 1}: isOpenLineEndsWithBrace=${isOpenLineEndsWithBrace}, isCloseLineStartsWithBrace=${isCloseLineStartsWithBrace}`);
        
        // 両方の条件を満たす場合のみネストレベルを増加
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            for (let i = openLine + 1; i < closeLine; i++) {
                lineNestLevels[i]++;
            }
        }
    }
    
    console.log('Line nest levels:', lineNestLevels);
    
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
                    const oldLine = result[i];
                    result[i] = innerIndent + trimmed;
                    console.log(`  Line ${i + 1} (nest ${nestLevel}): "${oldLine}" -> "${result[i]}"`);
                } else {
                    result[i] = '';
                }
            }
            
            // 閉じ括弧を適切な位置に配置
            const closeBraceAfter = closeLineText.substring(closePos + 1);
            result[closeLine] = '}' + closeBraceAfter;
        }
    }
    
    console.log('=== formatBraces: RESULT ===');
    result.forEach((line, i) => console.log(`  ${i + 1}: "${line}"`));
    
    return result;
}

// Test with the exact problematic content
const testContent = `\\documentclass{article}
\\usepackage{tikz}
\\usepackage{pgf}

\\begin{document}

  % Problem case 1: foreach loop
  \\foreach \\x in {-15,-14,...,15} {
  \\draw[dash pattern=on 0 off .25mm, line cap=round] (\\x,-15.25) -- (\\x,15.25);
  }\\

  % Problem case 2: Complex newcommand
  \\newcommand{\\drawInCoordinatePlane}[7]{
  % #1: fx (関数の式、例: \\x+2)
  % #2: x_min
  content here
  more content
  }\\

\\end{document}`;

const lines = testContent.split('\n');
const config = { useSpaces: true, tabSize: 2 };

console.log('=== TESTING ACTUAL EXECUTION ===');
const result = formatBraces(lines, config);

console.log('\n=== WRITING TO FILE ===');
fs.writeFileSync('/Users/keppy/dev/latex-align-indent/test/debug_result.tex', result.join('\n'));
console.log('Result written to debug_result.tex');