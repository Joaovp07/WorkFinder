import google from 'googlethis';
async function main() {
  const options = { page: 0, safe: false };
  const response = await google.search('remote front end developer jobs', options);
  console.log(Object.keys(response));
  console.log(JSON.stringify(response.results, null, 2));
}
main();
