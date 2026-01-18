Ollama Cloud model (workspace)

This workspace includes a lightweight model descriptor at `.vscode/ollama-models.json` that describes a user-provided Ollama Cloud API key and model.

Important: Do NOT commit your API key into the repo. Instead set the `OLLAMA_API_KEY` environment variable locally.

PowerShell (set for current terminal session):

```powershell
$env:OLLAMA_API_KEY = '5b2ac489666f49769780418077ca48f9.gx77Pfb6uCIRY8WMk8MAR_iQ'
```

Persist for future sessions (PowerShell):

```powershell
setx OLLAMA_API_KEY "5b2ac489666f49769780418077ca48f9.gx77Pfb6uCIRY8WMk8MAR_iQ"
```

Quick test (curl):

```bash
curl -s -X POST "https://api.ollama.com/chat?model=ollama" \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

How this is intended to be used
- The file `.vscode/ollama-models.json` is a workspace-local descriptor applications or local tooling can inspect to know there is an "ollama-cloud" model available and that the key lives in `OLLAMA_API_KEY`.
- If you install an Ollama-compatible VS Code extension or local client, point it to `https://api.ollama.com` and the model name `ollama`, and ensure `OLLAMA_API_KEY` is set in your environment.

If you'd like I can also:
- Add a small node/python wrapper that calls the Ollama Cloud chat endpoint using the env var.
- Attempt a live test from this environment (I won't commit the key anywhere else).
