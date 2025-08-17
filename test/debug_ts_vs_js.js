// Compare TypeScript logic vs working JavaScript logic
const fs = require('fs');

console.log('=== COMPARING TYPESCRIPT VS JAVASCRIPT LOGIC ===');

// JavaScript version that works
function findBracePairsJS(lines) {
    const braceInfos = [];
    const braceStack = [];
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        if (line.trim().startsWith('%')) {
            continue;
        }
        
        for (let pos = 0; pos < line.length; pos++) {
            const char = line[pos];
            
            if (char === '{') {
                if (pos > 0 && line[pos - 1] === '\\') {
                    const beforeBrace = line.substring(0, pos);
                    if (!beforeBrace.match(/\\(foreach|pgffor|for)\s*$/)) {
                        console.log(`JS: Skipping escaped brace at line ${lineIndex + 1}, pos ${pos}: "${beforeBrace}"`);
                        continue;
                    }
                }
                
                const indent = line.match(/^(\s*)/)?.[1] || '';
                braceStack.push({line: lineIndex, pos, indent});
                
            } else if (char === '}') {
                if (pos > 0 && line[pos - 1] === '\\') {
                    continue;
                }
                
                if (braceStack.length > 0) {
                    const openBrace = braceStack.pop();
                    
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

// TypeScript logic (converted to JS)
function findBracePairsTS(lines) {
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
                        console.log(`TS: Skipping escaped brace at line ${lineIndex + 1}, pos ${pos}: "${beforeBrace}"`);
                        continue;
                    } else {
                        console.log(`TS: Found foreach/pgffor/for command, processing brace at line ${lineIndex + 1}, pos ${pos}`);
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

// Test on the problematic code
const content = fs.readFileSync('/Users/keppy/dev/latex-align-indent/unindented_test.tex', 'utf8');
const lines = content.split('\n');

console.log('Testing on lines 8-10 (foreach):');
console.log(`  Line 8: "${lines[7]}"`);
console.log(`  Line 9: "${lines[8]}"`);
console.log(`  Line 10: "${lines[9]}"`);

console.log('\nTesting JavaScript logic:');
const jsResult = findBracePairsJS(lines);
console.log('JS found', jsResult.length, 'pairs');

console.log('\nTesting TypeScript logic:');
const tsResult = findBracePairsTS(lines);
console.log('TS found', tsResult.length, 'pairs');

// Compare results
console.log('\n=== COMPARISON ===');
console.log('JS pairs:', jsResult.map(p => `${p.openLine + 1}-${p.closeLine + 1}`));
console.log('TS pairs:', tsResult.map(p => `${p.openLine + 1}-${p.closeLine + 1}`));

// Check if they're identical
const jsStr = JSON.stringify(jsResult);
const tsStr = JSON.stringify(tsResult);
console.log('Results identical:', jsStr === tsStr);