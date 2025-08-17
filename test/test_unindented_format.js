// Test formatting on completely unindented code
const fs = require('fs');

// Copy of the improved formatting functions
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
        
        if (line.trim().startsWith('%')) {
            continue;
        }
        
        for (let pos = 0; pos < line.length; pos++) {
            const char = line[pos];
            
            if (char === '{') {
                if (pos > 0 && line[pos - 1] === '\\') {
                    const beforeBrace = line.substring(0, pos);
                    if (!beforeBrace.match(/\\(foreach|pgffor|for)\s*$/)) {
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

function formatBraces(lines, config) {
    const result = [...lines];
    
    const braceInfos = findBracePairs(result);
    
    console.log(`Found ${braceInfos.length} brace pairs`);
    
    // Sort brace pairs by opening line to calculate nesting levels
    braceInfos.sort((a, b) => a.openLine - b.openLine);
    
    // Calculate nesting levels for each line
    const lineNestLevels = new Array(result.length).fill(0);
    
    for (const braceInfo of braceInfos) {
        const {openLine, closeLine, openPos, closePos} = braceInfo;
        
        const openLineText = result[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
        
        const closeLineText = result[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        console.log(`Pair ${braceInfo.openLine + 1}-${braceInfo.closeLine + 1}: open="${afterBrace}", close="${beforeBrace}", should format: ${isOpenLineEndsWithBrace && isCloseLineStartsWithBrace}`);
        
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            for (let i = openLine + 1; i < closeLine; i++) {
                lineNestLevels[i]++;
            }
        }
    }
    
    console.log('Line nest levels (first 30):', lineNestLevels.slice(0, 30));
    
    // Apply indentation based on nesting levels
    for (const braceInfo of braceInfos.reverse()) {
        const {openLine, closeLine, openPos, closePos, baseIndent} = braceInfo;
        
        const openLineText = result[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
        
        const closeLineText = result[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            console.log(`Formatting brace pair: lines ${openLine + 1}-${closeLine + 1}`);
            
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
            
            const closeBraceAfter = closeLineText.substring(closePos + 1);
            const newCloseLine = baseIndent + '}' + closeBraceAfter;
            console.log(`  Close line: "${closeLineText}" -> "${newCloseLine}"`);
            result[closeLine] = newCloseLine;
        }
    }
    
    return result;
}

// Test configuration
const config = {
    useSpaces: true,
    tabSize: 4,
    formatBraces: true
};

// Read and process unindented test file
const content = fs.readFileSync('/Users/keppy/dev/latex-align-indent/unindented_test.tex', 'utf8');
const lines = content.split('\n');

console.log('=== UNINDENTED FORMATTING TEST ===');
console.log('Original lines count:', lines.length);

const formatted = formatBraces(lines, config);

console.log('\n=== AFTER FORMATTING ===');
formatted.forEach((line, i) => {
    console.log(`${i + 1}: ${line}`);
});

// Write result to file
fs.writeFileSync('/Users/keppy/dev/latex-align-indent/unindented_test_formatted.tex', formatted.join('\n'));