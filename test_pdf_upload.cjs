const fetch = require("node-fetch");
const FormData = require("form-data");
const { Blob } = require("buffer");

async function testPdf() {
  const formData = new FormData();
  formData.append("curriculo", "dummy content", {
    filename: "test.pdf",
    contentType: "application/pdf"
  });

  try {
    const res = await fetch("http://localhost:3000/api/extrair-curriculo", {
      method: "POST",
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
