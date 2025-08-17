// Debug complex LaTeX code brace detection
const fs = require('fs');

function findBracePairs(lines) {
    const braceInfos = [];
    const braceStack = [];
    
    console.log('=== ANALYZING EACH LINE ===');
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        console.log(`Line ${lineIndex + 1}: "${line}"`);
        
        if (line.trim().startsWith('%')) {
            console.log('  -> Skipping comment line');
            continue;
        }
        
        for (let pos = 0; pos < line.length; pos++) {
            const char = line[pos];
            
            if (char === '{') {
                console.log(`  -> Found '{' at position ${pos}`);
                
                if (pos > 0 && line[pos - 1] === '\\') {
                    const beforeBrace = line.substring(0, pos);
                    console.log(`    -> Previous char is '\\', beforeBrace: "${beforeBrace}"`);
                    
                    if (!beforeBrace.match(/\\(foreach|pgffor|for)\s*$/)) {
                        console.log(`    -> Not a foreach/pgffor/for command, skipping`);
                        continue;
                    } else {
                        console.log(`    -> Found foreach/pgffor/for command, processing`);
                    }
                }
                
                const indent = line.match(/^(\s*)/)?.[1] || '';
                braceStack.push({line: lineIndex, pos, indent});
                console.log(`    -> Added to stack (stack size: ${braceStack.length})`);
                
            } else if (char === '}') {
                console.log(`  -> Found '}' at position ${pos}`);
                
                if (pos > 0 && line[pos - 1] === '\\') {
                    console.log(`    -> Previous char is '\\', skipping escaped brace`);
                    continue;
                }
                
                if (braceStack.length > 0) {
                    const openBrace = braceStack.pop();
                    console.log(`    -> Popped from stack (stack size: ${braceStack.length})`);
                    
                    if (openBrace.line !== lineIndex) {
                        braceInfos.push({
                            openLine: openBrace.line,
                            closeLine: lineIndex,
                            openPos: openBrace.pos,
                            closePos: pos,
                            baseIndent: openBrace.indent
                        });
                        console.log(`    -> Added brace pair: lines ${openBrace.line + 1}-${lineIndex + 1}`);
                    } else {
                        console.log(`    -> Same line brace, not adding to pairs`);
                    }
                } else {
                    console.log(`    -> No matching opening brace in stack`);
                }
            }
        }
        
        console.log(`  -> End of line, stack size: ${braceStack.length}`);
    }
    
    return braceInfos;
}

const content = fs.readFileSync('/Users/keppy/dev/latex-align-indent/complex_test.tex', 'utf8');
const lines = content.split('\n');

console.log('=== COMPLEX TEST FILE ===');
lines.forEach((line, i) => {
    console.log(`${i + 1}: ${line}`);
});

console.log('\n=== BRACE DETECTION PROCESS ===');
const braceInfos = findBracePairs(lines);

console.log('\n=== DETECTED BRACE PAIRS ===');
braceInfos.forEach((info, i) => {
    console.log(`Pair ${i + 1}:`);
    console.log(`  Open: line ${info.openLine + 1}, pos ${info.openPos}`);
    console.log(`  Close: line ${info.closeLine + 1}, pos ${info.closePos}`);
    console.log(`  Open line: "${lines[info.openLine]}"`);
    console.log(`  Close line: "${lines[info.closeLine]}"`);
    
    // Check formatting conditions
    const openLineText = lines[info.openLine];
    const afterBrace = openLineText.substring(info.openPos + 1).trim();
    const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
    
    const closeLineText = lines[info.closeLine];
    const beforeBrace = closeLineText.substring(0, info.closePos).trim();
    const isCloseLineStartsWithBrace = beforeBrace === '';
    
    console.log(`  After open brace: "${afterBrace}"`);
    console.log(`  Before close brace: "${beforeBrace}"`);
    console.log(`  Should format: ${isOpenLineEndsWithBrace && isCloseLineStartsWithBrace}`);
    console.log('');
});