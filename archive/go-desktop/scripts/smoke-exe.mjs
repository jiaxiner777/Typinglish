import { spawn } from "node:child_process";

const exe = "release/Typinglish.exe";
const child = spawn(exe, [], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
let output = "";

child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findURL() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
    if (match) return match[0];
    await wait(500);
  }
  throw new Error(`Could not find server URL in exe output: ${output}`);
}

try {
  const url = await findURL();
  const health = await (await fetch(`${url}/api/v1/health`)).json();
  const html = await (await fetch(url)).text();
  const sources = await (await fetch(`${url}/api/v1/sources`)).json();
  const books = await (await fetch(`${url}/api/v1/sources?type=BOOK`)).json();
  const adventureMap = await (await fetch(`${url}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`)).json();
  const bookMap = await (await fetch(`${url}/api/v1/sources/${books[0].id}/map`)).json();
  const stream = await (await fetch(`${url}/api/v1/chunks/${bookMap.chunks[0].id}/stream?limit=80`)).json();
  console.log(
    JSON.stringify(
      {
        url,
        health,
        html: html.includes("Typinglish"),
        sources: sources.length,
        adventureChunks: adventureMap.chunks.length,
        books: books.length,
        firstBookChunks: bookMap.chunks.length,
        firstBookNodes: stream.nodes.length
      },
      null,
      2
    )
  );
} finally {
  child.kill();
}
