const fs = require('fs');

const filePath = 'F:/Operational Excellence Appliaction/modules/admin/permission-sync.js';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    // House emoji
    ['c3b0c5b8c28fc2a0', '&#127968;'],
    // Lock with different encoding
    ['c3b0c5b8e2809dc290', '&#128274;'],
    // Key with different encoding
    ['c3b0c5b8e2809de28098', '&#128273;'],
    // Party/celebration
    ['c3b0c5b8c5bde280b0', '&#127881;'],
    // Bullet point
    ['c3a2e282acc2a2', '&#8226;'],
    // BOM
    ['efbbbf', ''],
    // c28f stray
    ['c28f', ''],
    // c592 stray
    ['c592', ''],
    // e2809c stray (could be quote)
    ['e2809c', '"'],
];

let count = 0;
for (const [hexPattern, replacement] of replacements) {
    const pattern = Buffer.from(hexPattern, 'hex').toString('utf8');
    if (content.includes(pattern)) {
        const matches = content.split(pattern).length - 1;
        count += matches;
        content = content.split(pattern).join(replacement);
        console.log('Replaced', matches, 'of hex', hexPattern);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Total:', count);
