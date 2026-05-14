const fs = require('fs');
const FormData = require('form-data');
// ...
// Actually, let's just make it simple using node-fetch and standard streams
// Actually node-fetch might not be in package.json (wait, express is, maybe node-fetch is). I'll just use the built-in global `fetch` and `FormData` from Node headers if possible, or skip dummy.pdf testing and just check the server.ts code.
