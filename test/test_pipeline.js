// Test the complete formatting pipeline to see conflicts
const fs = require('fs');

// Copy the pipeline functions
function createIndent(level, config) {
    if (config.useSpaces) {
        return ' '.repeat(level * config.tabSize);
    } else {
        return '\t'.repeat(level);
    }
}

function trimTrailingWhitespace(lines) {
    return lines.map(line => line.replace(/\s+$/, ''));
}

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
    braceInfos.sort((a, b) => a.openLine - b.openLine);
    
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
    
    for (const braceInfo of braceInfos.reverse()) {
        const {openLine, closeLine, openPos, closePos, baseIndent} = braceInfo;
        
        const openLineText = result[openLine];
        const afterBrace = openLineText.substring(openPos + 1).trim();
        const isOpenLineEndsWithBrace = afterBrace === '' || afterBrace === '\\';
        
        const closeLineText = result[closeLine];
        const beforeBrace = closeLineText.substring(0, closePos).trim();
        const isCloseLineStartsWithBrace = beforeBrace === '';
        
        if (isOpenLineEndsWithBrace && isCloseLineStartsWithBrace) {
            console.log(`formatBraces: Processing brace pair ${openLine + 1}-${closeLine + 1}`);
            
            for (let i = openLine + 1; i < closeLine; i++) {
                const line = result[i];
                const trimmed = line.trim();
                
                if (trimmed !== '') {
                    const nestLevel = lineNestLevels[i];
                    const innerIndent = createIndent(nestLevel, config);
                    const newLine = innerIndent + trimmed;
                    console.log(`  formatBraces: Line ${i + 1} -> "${newLine}"`);
                    result[i] = newLine;
                } else {
                    result[i] = '';
                }
            }
            
            const closeBraceAfter = closeLineText.substring(closePos + 1);
            result[closeLine] = '}' + closeBraceAfter;
        }
    }
    
    return result;
}

function applyBasicIndentation(lines, config) {
    const result = [];
    let indentLevel = 0;
    
    const beginPattern = /^(\s*)\\begin\{([^}]+)\}/;
    const endPattern = /^(\s*)\\end\{([^}]+)\}/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (!trimmed) {
            result.push('');
            continue;
        }
        
        if (trimmed.startsWith('%')) {
            if (indentLevel > 0) {
                const newLine = createIndent(indentLevel, config) + trimmed;
                console.log(`applyBasicIndentation: Comment line ${i + 1} -> "${newLine}"`);
                result.push(newLine);
            } else {
                result.push(line);
            }
            continue;
        }
        
        let currentIndent = indentLevel;
        
        if (endPattern.test(trimmed)) {
            currentIndent = Math.max(0, indentLevel - 1);
            indentLevel = currentIndent;
        }
        
        const indentedLine = createIndent(currentIndent, config) + trimmed;
        console.log(`applyBasicIndentation: Line ${i + 1} -> "${indentedLine}"`);
        result.push(indentedLine);
        
        if (beginPattern.test(trimmed)) {
            indentLevel = currentIndent + 1;
        }
    }
    
    return result;
}

// Test pipeline
const config = {
    useSpaces: true,
    tabSize: 4,
    trimTrailingWhitespace: true,
    maxConsecutiveBlankLines: 1,
    formatBraces: true,
    indentEnvironments: true
};

// Create simple test case
const testLines = [
    '\\documentclass{article}',
    '\\begin{document}',
    '',
    '\\foreach \\x in {-15,-14,...,15} {',
    '\\draw[dash pattern=on 0 off .25mm, line cap=round] (\\x,-15.25) -- (\\x,15.25);',
    '}\\',
    '',
    '\\end{document}'
];

console.log('=== ORIGINAL ===');
testLines.forEach((line, i) => console.log(`${i + 1}: "${line}"`));

let lines = [...testLines];

console.log('\n=== STEP 1: trimTrailingWhitespace ===');
lines = trimTrailingWhitespace(lines);

console.log('\n=== STEP 2: limitConsecutiveBlankLines ===');
lines = limitConsecutiveBlankLines(lines, config.maxConsecutiveBlankLines);

console.log('\n=== STEP 3: formatBraces ===');
lines = formatBraces(lines, config);
console.log('After formatBraces:');
lines.forEach((line, i) => console.log(`${i + 1}: "${line}"`));

console.log('\n=== STEP 4: applyBasicIndentation ===');
lines = applyBasicIndentation(lines, config);
console.log('Final result:');
lines.forEach((line, i) => console.log(`${i + 1}: "${line}"`));