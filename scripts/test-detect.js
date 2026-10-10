async function run() {
  const url = 'https://www.codechef.com/build/react2/assets/index-B7KsL4Ix.js';
  const res = await fetch(url);
  const text = await res.text();
  const imports = [...text.matchAll(/["']([^"']*\.js)["']/g)].map(m => m[1]);
  console.log('Total js references in bundle:', imports.length);
  const assets = imports.filter(i => i.includes('assets/'));
  console.log('Asset chunks:', assets);
  
  for (const chunk of assets) {
    const chunkUrl = `https://www.codechef.com/build/react2/assets/${chunk.replace(/^\.\/|^assets\//, '')}`;
    try {
      const cRes = await fetch(chunkUrl);
      const cText = await cRes.text();
      if (cText.includes('compatible with this assessment') || cText.includes('Safe Exam Browser') || cText.includes('3.10.2')) {
        console.log('MATCH IN CHUNK:', chunkUrl);
        const idx = cText.indexOf('compatible with this assessment');
        if (idx !== -1) {
          console.log(cText.substring(idx - 300, idx + 400));
        } else {
          console.log('Found 3.10.2 or SEB');
        }
      }
    } catch (e) {}
  }
}
run();

