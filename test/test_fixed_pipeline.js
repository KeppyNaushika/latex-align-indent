// Test the fixed pipeline
const fs = require('fs');

// Test with the condition fix
function testFixedPipeline() {
    const config = {
        useSpaces: true,
        tabSize: 4,
        trimTrailingWhitespace: true,
        maxConsecutiveBlankLines: 1,
        formatBraces: true,
        indentEnvironments: true
    };

    const testLines = [
        '\\documentclass{article}',
        '\\begin{document}',
        '',
        '\\foreach \\x in {-15,-14,...,15} {',
        '\\draw[dash pattern=on 0 off .25mm, line cap=round] (\\x,-15.25) -- (\\x,15.25);',
        '}\\',
        '',
        '\\newcommand{\\test}{',
        'content here',
        'more content',
        '}\\',
        '',
        '\\end{document}'
    ];

    console.log('=== TESTING FIXED PIPELINE ===');
    console.log('formatBraces:', config.formatBraces);
    console.log('indentEnvironments:', config.indentEnvironments);
    console.log('Will applyBasicIndentation run?', config.indentEnvironments && !config.formatBraces);

    let lines = [...testLines];

    // Apply same pipeline as extension
    console.log('\n=== STEP 3: formatBraces ===');
    if (config.formatBraces) {
        // Use the formatBraces logic (simplified)
        const braceInfos = [
            { openLine: 3, closeLine: 5 },
            { openLine: 7, closeLine: 10 }
        ];
        
        for (const info of braceInfos.reverse()) {
            console.log(`formatBraces: Processing brace pair ${info.openLine + 1}-${info.closeLine + 1}`);
            for (let i = info.openLine + 1; i < info.closeLine; i++) {
                const trimmed = lines[i].trim();
                if (trimmed) {
                    const newLine = '    ' + trimmed;
                    console.log(`  Line ${i + 1}: "${lines[i]}" -> "${newLine}"`);
                    lines[i] = newLine;
                }
            }
            lines[info.closeLine] = '}\\';
        }
    }

    console.log('\\nAfter formatBraces:');
    lines.forEach((line, i) => console.log(`${i + 1}: "${line}"`));

    console.log('\\n=== STEP 7: applyBasicIndentation ===');
    const shouldApplyBasic = config.indentEnvironments && !config.formatBraces;
    console.log('Should apply applyBasicIndentation?', shouldApplyBasic);
    
    if (shouldApplyBasic) {
        console.log('Applying applyBasicIndentation...');
        // Would apply basic indentation here
    } else {
        console.log('Skipping applyBasicIndentation because formatBraces is enabled');
    }

    console.log('\\nFinal result:');
    lines.forEach((line, i) => console.log(`${i + 1}: "${line}"`));
}

testFixedPipeline();