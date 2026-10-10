# Continue from GitHub in a cloud environment

This repository contains the public source and versioned execution checkpoint. A local chat, uncommitted worktree, running server, model cache and USB phone are not a Git backup. Select the exact published branch and read `docs/execution.md` before changing anything.

Use the current cloud environment experience described in [OpenAI's guide](https://learn.chatgpt.com/docs/environments/cloud-environments). Repository access must be connected to your account. Choose this GitHub repository and the published integration branch; pin Node.js to 26.11.1 and run the source setup script:

```sh
bash scripts/cloud-setup.sh
npm test
npm run dev
```

The setup script runs a locked install and compiles the native adapters and browser application. It downloads no image corpus or model weights. Configure installation network access in the environment. Model/corpus research requires its separately recorded primary hosts and pinned hashes; avoid paid APIs and do not send user photos to a remote inference service. A successful cloud build does not establish laptop, Pixel 7, WebGPU or image-quality acceptance.

Attach `superaster-technical-spec.updated.md` revision 1.3 privately to the cloud chat, together with the original execution prompt. The owner chose to keep both specifications local. They are absent from the public repository, public branches and npm tarballs. Do not commit the attachment, private references or credentials. The checkpoint retains hashes so the receiving worker can identify the correct private parent and active revision.

Use this continuation prompt after attaching the private files:

> Continue Superaster from docs/execution.md on this exact branch and commit. Read the active attached spec and original execution policy, then inspect changed files and evidence. Preserve PASS/FAIL/NOT RUN and unchanged fixtures. Complete useful remaining work without charges. Do not repeat completed screening or tune before the required budget freeze. Physical Pixel 7 and human review remain external prerequisites; cloud hardware is not their substitute. Keep all specifications out of public Git.

Commit coherent changes and update the single checkpoint before ending cloud work. Push the working branch or create a reviewable PR. GitHub source preparation is not a G7 release and must not be described as one. The local machine retains raw outputs and caches that are marked local-only in the evidence; use the reproduction commands to obtain them elsewhere when needed.
