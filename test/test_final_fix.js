// Test the final fix
const fs = require('fs');

// Test the updated pipeline logic
function testFinalFix() {
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

    console.log('=== TESTING FINAL FIX ===');
    console.log('formatBraces:', config.formatBraces);
    console.log('indentEnvironments:', config.indentEnvironments);
    console.log('');
    console.log('Step 4 - formatBraces will run:', config.formatBraces);
    console.log('Step 6 - formatEnvironmentIndentation will run:', config.indentEnvironments && !config.formatBraces);
    console.log('Step 7 - applyBasicIndentation will run:', config.indentEnvironments && !config.formatBraces);
    console.log('');

    const expected = [
        '\\documentclass{article}',
        '\\usepackage{tikz}',
        '',
        '\\begin{document}',
        '',
        '\\foreach \\x in {-15,-14,...,15} {',
        '    \\draw[dash pattern=on 0 off .25mm, line cap=round] (\\x,-15.25) -- (\\x,15.25);',
        '}\\',
        '',
        '\\newcommand{\\drawInCoordinatePlane}[7]{',
        '    % #1: fx (関数の式、例: \\x+2)',
        '    % #2: x_min',
        '    % #3: x_max',
        '    content here',
        '    more content',
        '}\\',
        '',
        '\\end{document}'
    ];

    console.log('Expected result:');
    expected.forEach((line, i) => {
        console.log(`  ${i + 1}: "${line}"`);
    });

    console.log('\\nWith this fix:');
    console.log('- formatBraces() will handle ALL brace indentation');
    console.log('- formatEnvironmentIndentation() will be skipped');
    console.log('- applyBasicIndentation() will be skipped');
    console.log('- Only formatBraces() will control indentation');
}

testFinalFix();