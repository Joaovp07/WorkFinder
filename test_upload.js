import fs from "fs";

async function run() {
  const fileContent = fs.readFileSync("package.json");
  const formData = new FormData();
  formData.append("curriculo", new Blob([fileContent]), "test.pdf");

  try {
    const res = await fetch("http://localhost:3000/api/extrair-curriculo", {
      method: "POST",
      headers: { 'Accept': 'application/json' },
      body: formData
    });
    console.log(res.status, res.headers.get("content-type"));
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}
run();
