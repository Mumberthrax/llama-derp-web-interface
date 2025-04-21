// Handles communication with the llama.cpp backend server
// Data-oriented, no classes

/**
 * Send a message to the llama.cpp server and receive a streamed response.
 * @param {Array} messages - Array of message objects: {role: "user"|"assistant", content: string}
 * @param {function(string):void} onChunk - Called with each chunk of content received
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the request
 * @returns {Promise<void>}
 */
export async function sendMessage(messages, onChunk, signal) {
    const payload = {
        model: "llama-2-7b-chat", // TODO: allow dynamic model selection
        messages: messages.map(m => ({role: m.role, content: m.content})),
        stream: true
    };
    const response = await fetch("http://localhost:8080/v1/chat/completions", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
        signal
    });
    if (!response.body) throw new Error("No response stream");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        let lines = buffer.split("\n");
        buffer = lines.pop(); // incomplete line
        for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const jsonStr = line.slice(5).trim();
            if (jsonStr === "[DONE]" || jsonStr === "") continue;
            try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) onChunk(content);
            } catch (e) {
                console.error('Failed to parse chunk:', e);
                // Ignore parse errors for malformed lines
            }
        }
    }
}
