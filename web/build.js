// 빌드: src/app.html + src/qr-bundle.js + src/spec.json → index.html (GitHub Pages용 완전한 문서) 및 아티팩트용 본문 파일
// 사용: node build.js [아티팩트_출력경로]
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'src/app.html'), 'utf8');
const qr = fs.readFileSync(path.join(__dirname, 'src/qr-bundle.js'), 'utf8');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/spec.json'), 'utf8'));
const specJs = JSON.stringify(spec).replace(/<\/script/gi, '<\\/script');
const body = src.replace('/*__QR_BUNDLE__*/', () => qr).replace('/*__SPEC__*/{}', () => specJs);
const head = body.split('\n<div id="app">')[0];
const rest = body.split('\n<div id="app">')[1];
const full = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="color-scheme" content="dark light">\n${head}\n</head>\n<body>\n<div id="app">${rest}\n</body>\n</html>\n`;
fs.writeFileSync(path.join(__dirname, 'index.html'), full);
const out = process.argv[2];
if (out) fs.writeFileSync(out, `<script>window.DEMO_DEFAULT=true</script>\n${body}`);
console.log('index.html bytes', full.length, 'slides', (spec.slides || []).length, 'parts', (spec.parts || []).length, out ? 'artifact ' + out : '');
