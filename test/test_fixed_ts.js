// Test the fixed TypeScript logic
const fs = require('fs');

// Fixed TypeScript formatting logic
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
    
    // Basic brace spacing adjustment
    for (let i = 0; i < result.length; i++) {
        let line = result[i];
        
        if (line.trim().startsWith('%')) {
            continue;
        }
        
        line = line.replace(/\\([a-zA-Z]+)\s*\{/g, '\\$1{');
        line = line.replace(/\s+\}/g, '}');
        line = line.replace(/\{\s+([^\s])/g, '{$1');
        
        result[i] = line;
    }
    
    const braceInfos = findBracePairs(result);
    
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
        
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            for (let i = openLine + 1; i < closeLine; i++) {
                lineNestLevels[i]++;
            }
        }
    }
    
    // Apply indentation based on nesting levels (FIXED VERSION)
    for (const braceInfo of braceInfos.reverse()) {
        const {openLine, closeLine, openPos, closePos, baseIndent} = braceInfo;
        
        const openLineText = result[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
        
        const closeLineText = result[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            console.log(`Processing brace pair ${openLine + 1}-${closeLine + 1}`);
            
            // FIXED: Don't use baseIndent, only use nesting level
            for (let i = openLine + 1; i < closeLine; i++) {
                const line = result[i];
                const trimmed = line.trim();
                
                if (trimmed !== '') {
                    const nestLevel = lineNestLevels[i];
                    const innerIndent = createIndent(nestLevel, config);
                    const newLine = innerIndent + trimmed;  // FIXED: removed baseIndent
                    console.log(`  Line ${i + 1} (nest ${nestLevel}): "${line}" -> "${newLine}"`);
                    result[i] = newLine;
                } else {
                    result[i] = '';
                }
            }
            
            // FIXED: Don't use baseIndent for closing brace
            const closeBraceAfter = closeLineText.substring(closePos + 1);
            const newCloseLine = '}' + closeBraceAfter;  // FIXED: removed baseIndent
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

console.log('=== TESTING FIXED TYPESCRIPT LOGIC ===');

// Test on the unindented file
const content = fs.readFileSync('/Users/keppy/dev/latex-align-indent/unindented_test.tex', 'utf8');
const lines = content.split('\n');

const formatted = formatBraces(lines, config);

console.log('\nFirst 15 lines after FIXED formatting:');
formatted.slice(0, 15).forEach((line, i) => {
    console.log(`  ${i + 1}: "${line}"`);
});

// Write result
fs.writeFileSync('/Users/keppy/dev/latex-align-indent/fixed_ts_result.tex', formatted.join('\n'));
console.log('\nFixed result written to fixed_ts_result.tex');