async function testPdf() {
  try {
    const res = await fetch("http://localhost:3000/api/extrair-curriculo", {
      method: "POST"
    });
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    const text = await res.text();
    console.log("Body:", text.substring(0, 200));
  } catch(e) {
    console.error(e);
  }
}
testPdf();
