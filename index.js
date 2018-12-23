const fs = require('fs');

console.log(getTemplate());

function getTemplate() {
    const content = fs.readFileSync('template.json','utf-8');
    return JSON.parse(content);
}
