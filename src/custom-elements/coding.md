VERY IMPORTANT:

Do not use try catch blocks unless it is for the fetch.
Let it fail.

Do not use function checks like:
if(x.y === 'function')

For private members, use # prefix, never _ (underscore)

In custom elements, assign an id attribute to unique elements.

WebSocket updates: keep it simple
- Keep handlers minimal; avoid complex branching/logging.
- On any document-change message, refresh the open document if URN matches.
- Optionally refresh ee-reference elements that target the URN.

Top bar element IDs for the editor (for accessibility and testing):
- `toggle-content-tree`
- `back-to-gallery`
- `open-preview`
- `fragment-name`
- `undo`
- `redo`
- `zoom-out`
- `reset-zoom`
- `zoom-in`
- `open-comments`
- `open-versions`
- `open-used-in`
- `save-indicator`
- `publish`
- `unpublish`
- `copy-menu`
- `export-menu`
