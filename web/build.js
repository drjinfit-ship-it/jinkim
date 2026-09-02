// 빌드: src/app.html + QR 번들 → index.html (GitHub Pages용 완전한 문서) 및 아티팩트용 본문 파일
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'src/app.html'),'utf8');
const qr=fs.readFileSync(path.join(__dirname,'src/qr-bundle.js'),'utf8');
const body=src.replace('/*__QR_BUNDLE__*/',()=>qr);
const full=`<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="color-scheme" content="dark light">\n${body.split('\n<div id="app">')[0]}\n</head>\n<body>\n<div id="app">${body.split('\n<div id="app">')[1]}\n</body>\n</html>\n`;
fs.writeFileSync(path.join(__dirname,'index.html'),full);
const out=process.argv[2];
if(out){fs.writeFileSync(out,`<script>window.DEMO_DEFAULT=true</script>\n${body}`);}
console.log('index.html bytes',full.length, out?('artifact '+out):'');
