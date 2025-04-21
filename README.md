# llama.cpp Multi-Character Chatbot UI

A modern, browser-based chatbot interface for local LLMs (like llama.cpp), supporting multiple AI personas, persistent conversations, and a highly interactive UI. Built for privacy, extensibility, and ease of use.

---

**Note:** readme and almost all code comopsed by chatgpt. it's... a little bit dumb. I used windsurf with the free trial of chatgpt 4.1 and nearly pure 'vibe coding'. I am not a web developer, and I have not really examined the code here directly. I just bullied chatgpt to fix problems as they appeared. I do not recommend this approach at all unless the quality of the product doesn't really matter, or its something that's easily within the AI's capabilities, like making a simple web app. This one might be a bit more complex than the AI really ought to be handling on its own.

## Features

- **Multi-Character Support:** Create, edit, and chat with multiple AI personas (avatars, names, custom system prompts).
- **Persistent Conversations:** Conversations and characters are saved in your browser (IndexedDB/localStorage).
- **Streaming LLM Responses:** Real-time, chunked replies from your LLM backend (tested with llama.cpp HTTP server).
- **Conversation Management:** Rename, auto-title (via LLM), delete, and switch between conversations.
- **Rich UI:** Responsive sidebar, modals for editing, keyboard shortcuts, and a clean, modern look.
- **No External Dependencies:** All logic is client-side JavaScript (ES modules).

---

## Demo / GitHub Pages

You can deploy this project as a static site (e.g., GitHub Pages). **However, to function, it requires a running LLM backend server (like llama.cpp) accessible via HTTP from the browser.**

- Place all files in a GitHub repository.
- Enable GitHub Pages ("Deploy from branch" or `docs/` folder).
- Access the UI at `https://<your-username>.github.io/<repo-name>/chatbot.html`.
- **Note:** You must configure your backend LLM server (default: `http://localhost:8080/v1/chat/completions`) to be accessible from the browser, and CORS must be enabled.

---

## Quick Start

1. **Clone or Download** this repository.
2. **(Optional)** Edit `js/api.js` to point to your LLM backend if not using the default llama.cpp endpoint.
3. **Serve the files with a local web server** (see below), or deploy to GitHub Pages.
4. **Start your LLM backend** (e.g., llama.cpp HTTP server) and ensure it's reachable from your browser.

---

## Serving Locally

Because this app uses JavaScript ES modules, it **cannot be loaded directly from local files** (file:// URLs). You must use a local web server. Here are some easy options:

- **Python 3** (built-in):
  ```sh
  python3 -m http.server 8000
  # Then visit http://localhost:8000/chatbot.html
  ```
- **Node.js (http-server)**:
  ```sh
  npx http-server .
  # Then visit the printed URL
  ```
- **Other**: Any static web server will work.

---

## Backend Requirements

- **llama.cpp** (or compatible LLM HTTP server)
  - Should support OpenAI-compatible streaming responses.
  - Default endpoint: `http://localhost:8080/v1/chat/completions`
  - CORS must be enabled for browser access.
- **(Optional)** `llamaclient.lua` is provided for advanced backend streaming integrations.

---

## File Structure

```
├── chatbot.html         # Main HTML entry point
├── css/
│   └── style.css       # Styles
├── js/
│   ├── api.js          # LLM backend communication
│   ├── character.js    # Character/persona management
│   ├── db.js           # IndexedDB/localStorage persistence
│   ├── eventHandlers.js# UI event wiring
│   ├── generateTitle.js# Auto-title conversations
│   ├── promptReplacements.js # Prompt templating
│   ├── render.js       # UI rendering logic
│   ├── state.js        # Centralized app state
│   └── ui.js           # UI initialization, modals, glue
├── llamaclient.lua     # (Optional) Lua backend client
├── ui_design.txt       # UI/UX notes
└── LICENSE             # MIT License
```

---

## Customization

- **Add/Edit Characters:** Use the sidebar or modals to create/edit AI personas (name, avatar, system prompt, greeting).
- **System Prompts:** Use variables like `{{user}}` and `{{char}}` in prompts for dynamic replacement.
- **Settings:** Change user name/avatar, reset all data, and more via the settings modal.

---

## Development

- Pure client-side JavaScript (ES modules).
- No build step required—just serve as static files.
- Designed for easy extension: add new characters, UI features, or backend integrations.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

---

## Acknowledgements

- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- OpenAI API compatibility
- UI/UX inspired by modern chat apps

---

## Troubleshooting

- **Backend not responding?** Make sure your LLM server is running and accessible from your browser (CORS enabled).
- **Data not saving?** Ensure your browser allows IndexedDB/localStorage.
- **UI issues?** Use a modern browser (Chrome, Firefox, Edge, Safari, etc).

---

## Contact

For questions, suggestions, or contributions, open an issue or pull request on GitHub.
