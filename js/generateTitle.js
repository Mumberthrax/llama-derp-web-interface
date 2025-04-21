// Handler to generate a conversation title using the LLM
import { state, saveState, renameConversation } from './state.js';
import { sendMessage } from './api.js';
import { renderSidebar, renderTitleBar } from './render.js';
import { onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick } from './eventHandlers.js';

/**
 * Generate a succinct title for a conversation using the LLM.
 * @param {number} convId - The conversation ID
 * @param {function} onDone - Optional callback after renaming
 */
export async function generateTitle(convId, onDone) {
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv || !conv.messages || conv.messages.length === 0) return;
    // Take first two messages (user/assistant)
    const firstMsgs = conv.messages.slice(0, 2).map(m => `${m.role}: ${m.content}`).join('\n');
    const instruction = '[Instruction: Write a very brief and succinct title that describes the main topic of this chat.]';
    const systemPrompt = `${instruction}\n${firstMsgs}\n${instruction}`;
    const messages = [
        { role: 'system', content: systemPrompt }
    ];
    let result = '';
    await sendMessage(messages, chunk => { result += chunk; });
    const title = result.trim().replace(/\s+/g, ' ');
    if (title) {
        renameConversation(convId, title);
        saveState();
        renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
        renderTitleBar();
        if (onDone) onDone(title);
    }
}
