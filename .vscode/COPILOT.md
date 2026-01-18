Workspace Copilot configuration

This workspace enables GitHub Copilot inline suggestions and sets the preferred suggestion model to `copilot` in workspace settings.

If you need to change the Copilot model or verify the setting:

- Open VS Code Settings (Ctrl+,)
- Search for "Copilot" and review entries under the "GitHub Copilot" section
- To override the model, change the setting `github.copilot.suggestionModel` to the desired model name

Note: The exact model names and settings depend on the installed Copilot extension version and the GitHub Copilot service. If the extension doesn't expose `suggestionModel`, change the model via the Copilot extension UI or update the extension to the latest version.
