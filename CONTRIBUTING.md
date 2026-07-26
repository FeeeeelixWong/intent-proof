# Contributing to IntentProof

Thanks for helping make AI-agent transactions easier to inspect and safer to approve.

## Find a task

Use the [`agent-task`](https://github.com/FeeeeelixWong/intent-proof/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22agent-task%22) list. Tasks marked `good first issue` are intentionally small and include acceptance criteria. Comment on an issue before starting so contributors do not duplicate work.

## Set up the project

```bash
git clone https://github.com/YOUR_USERNAME/intent-proof.git
cd intent-proof
npm install
npm run dev
```

## Validate a change

```bash
npm test
npm run lint
npm run build
```

Behavior changes should include deterministic tests. Do not include secrets, wallet recovery material, unrelated dependency updates, or generated build output.

## Submit a pull request

1. Fork the public repository. Direct write access is not required.
2. Create one branch and pull request per issue.
3. Explain what changed and how it was tested.
4. Include screenshots for visible UI changes.
5. Disclose meaningful use of a coding agent and note any part that was not manually verified.

The maintainer retains final review and merge control. Accepted contributors are credited in release notes and may be highlighted in the README. Community tasks are not paid bounties unless a specific issue explicitly states a reward and its terms.

## Security reports

Do not open a public issue for a vulnerability that could expose user funds, wallet data, or a signing bypass. Use GitHub's private vulnerability reporting for this repository when available.
