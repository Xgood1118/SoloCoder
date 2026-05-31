const { ChineseTokenizer } = require('./dist/analyzer/tokenizer');

const tokenizer = new ChineseTokenizer();
console.log('Tokenizing "机器学习":');
const tokens = tokenizer.tokenize('机器学习');
console.log(JSON.stringify(tokens, null, 2));
