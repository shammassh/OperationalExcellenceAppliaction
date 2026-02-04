const fs = require('fs');
let content = fs.readFileSync('F:/Operational Excellence Appliaction/modules/security/index.js', 'utf8');

// Replace the corrupted emoji sequences with HTML entities
// Clipboard emoji
content = content.split(String.fromCharCode(240, 376, 8220, 8249)).join('&#128203;');

// Package emoji
content = content.split(String.fromCharCode(240, 376, 8220, 166)).join('&#128230;');

// Camera emoji
content = content.split(String.fromCharCode(240, 376, 8220, 183)).join('&#128247;');

fs.writeFileSync('F:/Operational Excellence Appliaction/modules/security/index.js', content, 'utf8');
console.log('Fixed emojis');
