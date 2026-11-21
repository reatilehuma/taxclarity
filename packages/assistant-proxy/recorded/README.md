# Recorded replies

`replies.json` holds model replies used to test the safety checks in CI without calling the model.

**Status: scripted, not yet recorded.** These were written by hand to look like real replies (and a few bad ones on
purpose). To replace them with real ones, run the live smoke test with an API key:

    ANTHROPIC_API_KEY=... npm run smoke -w packages/assistant-proxy -- --record

It asks the real model each sample question, runs the same checks the proxy runs, and rewrites `replies.json`.
That spends a small amount of money, so run it on purpose.
