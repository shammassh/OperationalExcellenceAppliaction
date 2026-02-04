const fs = require('fs');
let content = fs.readFileSync('F:/Operational Excellence Appliaction/modules/security/index.js', 'utf8');

const replacements = {
    'ðŸ"‹': '&#128203;',
    'ðŸ"¦': '&#128230;',
    'ðŸ"·': '&#128247;',
    'ðŸš—': '&#128663;',
    'ðŸš¶': '&#128694;',
    'ðŸšª': '&#128682;',
    'ðŸ…¿ï¸': '&#127359;',
    'â†': '&#8592;'
};

for (const [from, to] of Object.entries(replacements)) {
    content = content.split(from).join(to);
}

fs.writeFileSync('F:/Operational Excellence Appliaction/modules/security/index.js', content, 'utf8');
console.log('Done replacing emojis');
