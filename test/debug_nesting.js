// Debug nesting level calculation
const fs = require('fs');

// Reproduce the exact nesting logic from extension.ts
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

function debugNestingLevels() {
    const testLines = [
        '\\documentclass{article}',
        '\\begin{document}',
        '',
        '\\foreach \\x in {-15,-14,...,15} {',
        '\\draw[dash pattern=on 0 off .25mm, line cap=round] (\\x,-15.25) -- (\\x,15.25);',
        '}\\',
        '',
        '\\newcommand{\\drawInCoordinatePlane}[7]{',
        '% Comment line',
        '\\begin{scope}',
        '\\clip (#2,#4) rectangle (#3,#5);',
        '\\end{scope}',
        '}\\',
        '',
        '\\end{document}'
    ];

    console.log('=== DEBUG NESTING LEVELS ===');
    console.log('Input lines:');
    testLines.forEach((line, i) => console.log(`  ${i + 1}: "${line}"`));

    const braceInfos = findBracePairs(testLines);
    console.log('\\nFound brace pairs:');
    braceInfos.forEach((info, i) => {
        console.log(`  ${i + 1}: lines ${info.openLine + 1}-${info.closeLine + 1} (pos ${info.openPos}-${info.closePos})`);
    });

    // ネストレベルを計算するために中括弧ペアを開始行でソート
    braceInfos.sort((a, b) => a.openLine - b.openLine);
    
    // 各行のネストレベルを計算
    const lineNestLevels = new Array(testLines.length).fill(0);
    
    console.log('\\nCalculating nest levels...');
    for (const braceInfo of braceInfos) {
        const {openLine, closeLine, openPos, closePos} = braceInfo;
        
        // 開き括弧の行をチェック - 括弧で終わっているか（バックスラッシュも考慮）
        const openLineText = testLines[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
        
        // 閉じ括弧の行をチェック - 括弧で始まっているか
        const closeLineText = testLines[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        console.log(`  Brace pair ${openLine + 1}-${closeLine + 1}:`);
        console.log(`    openLineText: "${openLineText}"`);
        console.log(`    afterBrace: "${afterBrace}"`);
        console.log(`    isOpenLineEndsWithBrace: ${isOpenLineEndsWithBrace}`);
        console.log(`    closeLineText: "${closeLineText}"`);
        console.log(`    beforeBrace: "${beforeBrace}"`);
        console.log(`    isCloseLineStartsWithBrace: ${isCloseLineStartsWithBrace}`);
        
        // 両方の条件を満たす場合のみネストレベルを増加
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            console.log(`    ✓ Adding nesting for lines ${openLine + 2}-${closeLine}`);
            for (let i = openLine + 1; i < closeLine; i++) {
                lineNestLevels[i]++;
                console.log(`      Line ${i + 1}: nest level ${lineNestLevels[i]}`);
            }
        } else {
            console.log(`    ✗ Skipping nesting (conditions not met)`);
        }
    }

    console.log('\\nFinal nest levels:');
    lineNestLevels.forEach((level, i) => {
        console.log(`  Line ${i + 1}: nest level ${level}`);
    });

    // Apply indentation with nest levels
    const config = { useSpaces: true, tabSize: 4 };
    console.log('\\nApplying indentation:');
    
    for (const braceInfo of braceInfos.reverse()) {
        const {openLine, closeLine, openPos, closePos} = braceInfo;
        
        // 開き括弧の行をチェック - 括弧で終わっているか（バックスラッシュも考慮）
        const openLineText = testLines[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
        
        // 閉じ括弧の行をチェック - 括弧で始まっているか
        const closeLineText = testLines[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        // 両方の条件を満たす場合のみインデント処理を実行
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            console.log(`\\nProcessing brace pair ${openLine + 1}-${closeLine + 1}:`);
            
            // 中括弧内の行をインデント
            for (let i = openLine + 1; i < closeLine; i++) {
                const line = testLines[i];
                const trimmed = line.trim();
                
                if (trimmed !== '') {
                    const nestLevel = lineNestLevels[i];
                    const innerIndent = createIndent(nestLevel, config);
                    const newLine = innerIndent + trimmed;
                    console.log(`  Line ${i + 1} (nest ${nestLevel}): "${line}" -> "${newLine}"`);
                    testLines[i] = newLine;
                }
            }
            
            // 閉じ括弧を適切な位置に配置
            const closeBraceAfter = closeLineText.substring(closePos + 1);
            testLines[closeLine] = '}' + closeBraceAfter;
        }
    }

    console.log('\\n=== FINAL RESULT ===');
    testLines.forEach((line, i) => console.log(`  ${i + 1}: "${line}"`));
}

debugNestingLevels();