async function test() {
  const largeBase64 = 'A'.repeat(150 * 1024); // 150 KB base64 payload
  try {
    const res = await fetch('http://localhost:3000/api/webhook-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: 'https://hook.us1.make.com/abcdef',
        payload: { test: largeBase64 }
      })
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}
test();
