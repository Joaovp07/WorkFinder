import fs from "fs";

async function testPdf() {
  const formData = new FormData();
  const fileBlob = new Blob([fs.readFileSync("package.json")], { type: "application/pdf" });
  formData.append("curriculo", fileBlob, "test.pdf");

  try {
    const res = await fetch("http://localhost:3000/api/extrair-curriculo", {
      method: "POST",
      headers: {
        'Accept': 'application/json',
      },
      body: formData
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
