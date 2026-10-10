async function run() {
  const url = 'https://www.codechef.com/build/react2/assets/index-B7KsL4Ix.js';
  const res = await fetch(url);
  const text = await res.text();
  const imports = [...text.matchAll(/assets\/[a-zA-Z0-9_-]+\.js/g)].map(m => m[0]);
  const unique = [...new Set(imports)];
  console.log('Total unique chunks:', unique.length);

  for (let i = 0; i < unique.length; i++) {
    const chunk = unique[i];
    const chunkUrl = `https://www.codechef.com/build/react2/${chunk}`;
    try {
      const cRes = await fetch(chunkUrl);
      const cText = await cRes.text();
      if (cText.includes('compatible with this assessment')) {
        console.log('FOUND IN CHUNK:', chunkUrl);
        const idx = cText.indexOf('compatible with this assessment');
        console.log(cText.substring(Math.max(0, idx - 500), Math.min(cText.length, idx + 500)));
        return;
      }
    } catch (e) {}
  }
  console.log('Finished search.');
}
run();

