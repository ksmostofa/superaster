// SPDX-License-Identifier: Apache-2.0
const repositoryExample = `ONNXRUNTIME_NODE_INSTALL=skip npm ci
npm run build
node dist/native/cli/src/index.js models install birefnet-lite-512-fp16
node dist/native/cli/src/index.js remove input.jpg --quality fast --output cutout.png`;

const sdkExample = `import { createProcessor } from 'superaster-local';
const processor = createProcessor();
try { const result = await processor.transform(bytes, recipe); }
finally { await processor.dispose(); }`;

const mcpExample = `superaster mcp --roots /absolute/path/to/images`;

export function DocsPage() {
  return (
    <main className="docs">
      <p className="eyebrow">Same contract, every interface</p>
      <h1>Run it locally.</h1>
      <p>
        Superaster uses approved ONNX artifacts and preserves your originals. The
        current build is an alpha with pending device and quality validation. G2
        acceptance is pending, and runtime guards are provisional.
      </p>
      <h2>From this repository</h2>
      <pre><code>{repositoryExample}</code></pre>
      <p>
        This example explicitly selects Fast, the lighter model. Both profiles
        still require quality admission. Set up the app, runtime and approved
        model before processing offline.
      </p>
      <h2>SDK</h2>
      <p>Bind your image bytes and an explicit recipe to the local processor.</p>
      <pre><code>{sdkExample}</code></pre>
      <h2>Local MCP</h2>
      <pre><code>{mcpExample}</code></pre>
      <p>
        Configure the authorized client with this command. Files must be inside
        its configured roots.
      </p>
      <h2>Optional WebMCP</h2>
      <p>
        WebMCP requires a compatible browser and authorized client. Tools belong
        to the active app page and end when that page closes. Browser and client
        integration still requires validation. Ordinary image controls remain
        available.
      </p>
      <h2>Source and notices</h2>
      <p>
        <a href="https://github.com/ksmostofa/superaster">
          Source, installation and failure reports
        </a>
      </p>
      <p>
        <a href="/THIRD_PARTY_NOTICES.md">Third-party notices</a>
        {' · '}
        <a href="/third-party-licenses/SOURCES.md">
          Library source and replacement instructions
        </a>
      </p>
    </main>
  );
}
