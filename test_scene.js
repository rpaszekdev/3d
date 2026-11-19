const code = `
V 16 16 16

B 4 10 2 3 3 2

B 5 9 2 1 1 1

B 2 5 8 4 3 2

B 9 5 9 1 1 1

B 2 5 9 4 2 2

`;

const {textViewFromCode} = require('./voxi-reasoning/text-view.js');
console.log(textViewFromCode(code));
