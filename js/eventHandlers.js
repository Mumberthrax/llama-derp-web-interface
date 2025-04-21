// Event handler functions for chatbot UI
import { setActiveConversation, saveState, updateConversationSettings, getActiveConversation, addConversation, toggleSidebarCollapsed, state, renameConversation, deleteConversation, createPendingConversation, promotePendingConversation } from './state.js';
import { renderSidebar, renderTitleBar, renderMessages } from './render.js';
import { streamAssistantResponse, stopGeneration, getAbortController, setAbortController } from './ui.js';
import { ensureAssistantAlternates, getIsGenerating, setIsGenerating } from './state.js';
import { applyPromptReplacements } from './promptReplacements.js';

// Handler for clicking a conversation entry in the sidebar
export function onConversationEntryClick(convId) {
    setActiveConversation(convId);
    saveState();
    renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
    renderTitleBar(onOptionsButtonClick);
    renderMessages();
    setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) input.focus();
    }, 0);
}

// Handler for clicking the new chat button
export function onNewChatClick() {
    // Always create a pending conversation with greeting if present
    state.pendingConversation = createPendingConversation(state.selectedCharacterId);
    // Promote it immediately to a real conversation
    const conv = promotePendingConversation();
    setActiveConversation(conv.id);
    saveState();
    renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
    renderTitleBar(onOptionsButtonClick);
    renderMessages();
    setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) input.focus();
    }, 0);
}

// Handler for collapsing the sidebar
export function onSidebarCollapseClick() {
    toggleSidebarCollapsed();
    renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
    renderTitleBar(onOptionsButtonClick);
    renderMessages();
}

// Handler for showing the conversation options modal
export function onOptionsButtonClick() {
    const conv = state.pendingConversation && state.pendingConversation.characterId === state.selectedCharacterId
        ? state.pendingConversation
        : getActiveConversation();
    if (!conv) return;
    // Modal overlay
    let modal = document.createElement('div');
    modal.id = 'options-modal';
    // Modal content
    let content = document.createElement('div');
    content.id = 'options-modal-content';
    // User name
    let userLabel = document.createElement('label');
    userLabel.textContent = 'User Name:';
    let userInput = document.createElement('input');
    userInput.value = conv.userName || '';
    // Bot name
    let botLabel = document.createElement('label');
    botLabel.textContent = 'Bot Name:';
    let botInput = document.createElement('input');
    // If botName is blank, use character's name as default
    if (conv.botName && conv.botName.trim()) {
        botInput.value = conv.botName;
    } else {
        const char = state.characters.find(c => c.id === conv.characterId);
        botInput.value = (char && char.name) ? char.name : 'Assistant';
    }
    // System prompt
    let sysLabel = document.createElement('label');
    sysLabel.textContent = 'System Message:';
    let sysInput = document.createElement('textarea');
    // When opening the modal, show the editable template (with placeholders) if it exists
    if (conv.systemPromptTemplate !== undefined) {
        sysInput.value = conv.systemPromptTemplate;
    } else if (conv.systemPrompt && conv.systemPrompt.trim()) {
        sysInput.value = conv.systemPrompt;
    } else {
        const char = state.characters.find(c => c.id === conv.characterId);
        sysInput.value = (char && char.systemPrompt) ? char.systemPrompt : '';
    }
    // Actions
    let actions = document.createElement('div');
    actions.className = 'options-actions';
    let saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => {
        conv.userName = userInput.value.trim();
        conv.botName = botInput.value.trim();
        // Store the editable template (with placeholders) for the modal
        conv.systemPromptTemplate = sysInput.value;
        // Store the resolved system prompt for use in context
        conv.systemPrompt = applyPromptReplacements(sysInput.value, {
            userName: conv.userName || 'User',
            botName: conv.botName || 'Assistant'
        });
        saveState();
        renderTitleBar(onOptionsButtonClick);
        renderMessages();
        document.body.removeChild(modal);
    };
    let cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
        document.body.removeChild(modal);
    };
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    // Compose content
    content.appendChild(userLabel);
    content.appendChild(userInput);
    content.appendChild(botLabel);
    content.appendChild(botInput);
    content.appendChild(sysLabel);
    content.appendChild(sysInput);
    content.appendChild(actions);
    modal.appendChild(content);
    modal.onclick = e => { if (e.target === modal) document.body.removeChild(modal); };
    document.body.appendChild(modal);
    userInput.focus();
}

// Dropdown menu for conversation entries
let openMenuConvId = null;

export function onEntryMenuClick(convId, event) {
    event.stopPropagation();
    // Close any open menu
    const existing = document.querySelector('.sidebar-entry-menu');
    if (existing) existing.remove();
    if (openMenuConvId === convId) {
        openMenuConvId = null;
        return;
    }
    openMenuConvId = convId;
    // Find the entry element and menu button
    const entry = event.currentTarget.closest('.sidebar-entry');
    const menuBtn = event.currentTarget;
    const menu = document.createElement('div');
    menu.className = 'sidebar-entry-menu';
    // Position menu next to the button
    const btnRect = menuBtn.getBoundingClientRect();
    const sidebarRect = document.getElementById('sidebar').getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = btnRect.left + 'px';
    menu.style.top = (btnRect.bottom + 2) + 'px';
    // Menu options
    const rename = document.createElement('div');
    rename.textContent = 'Rename';
    rename.onclick = (e) => {
        e.stopPropagation();
        const newTitle = prompt('Rename conversation:');
        if (newTitle && newTitle.trim()) {
            renameConversation(convId, newTitle.trim());
            saveState();
            renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
            renderTitleBar(onOptionsButtonClick);
        }
        menu.remove();
        openMenuConvId = null;
    };
    const generateTitleOpt = document.createElement('div');
    generateTitleOpt.textContent = 'Generate Title';
    generateTitleOpt.onclick = async (e) => {
        e.stopPropagation();
        menu.remove();
        openMenuConvId = null;
        // Dynamically import to avoid circular deps
        const mod = await import('./generateTitle.js');
        await mod.generateTitle(convId);
    };
    const del = document.createElement('div');
    del.textContent = 'Delete';
    del.onclick = (e) => {
        e.stopPropagation();
        if (confirm('Delete this conversation?')) {
            deleteConversationHandler(convId);
        }
        menu.remove();
        openMenuConvId = null;
    };
    menu.appendChild(rename);
    menu.appendChild(generateTitleOpt);
    menu.appendChild(del);
    document.body.appendChild(menu);
    // Close menu on click elsewhere
    document.addEventListener('click', function handler() {
        menu.remove();
        openMenuConvId = null;
        document.removeEventListener('click', handler);
    });
}

// Handler for deleting a conversation (update active conversation and pending logic)
export function deleteConversationHandler(convId) {
    deleteConversation(convId);
    // After deletion, if there are no conversations for the selected character, create a pending conversation
    const filteredConvs = state.conversations.filter(c => c.characterId === state.selectedCharacterId);
    if (filteredConvs.length === 0) {
        state.pendingConversation = createPendingConversation(state.selectedCharacterId);
    } else {
        state.pendingConversation = null;
        setActiveConversation(filteredConvs[filteredConvs.length-1].id);
    }
    saveState();
    renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
    renderTitleBar(onOptionsButtonClick);
    renderMessages();
}

// Regenerate message handler for message controls
export async function onRegenerateMessage(idx) {
    const conv = getActiveConversation();
    if (!conv) return;
    const msg = conv.messages[idx];
    // UI: set send button to stop state
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.innerHTML = '<span style="font-size:1.35em;line-height:1;">&#9632;</span>';
        sendBtn.title = 'Stop generation';
        sendBtn.classList.add('stop-btn');
        sendBtn.disabled = false;
    }
    setIsGenerating(true);
    setAbortController(new AbortController());
    window.isGenerating = true;
    if (msg && msg.role === 'assistant') {
        // Ensure alternates model
        ensureAssistantAlternates(msg);
        // Build context up to and including last user message
        let userIdx = -1;
        for (let i = idx - 1; i >= 0; i--) {
            if (conv.messages[i].role === 'user') {
                userIdx = i;
                break;
            }
        }
        if (userIdx === -1) return;
        const contextMessages = [];
        if (conv.systemPrompt && conv.systemPrompt.trim()) {
            contextMessages.push({ role: 'system', content: conv.systemPrompt });
        }
        for (let i = 0; i <= userIdx; i++) {
            contextMessages.push({ role: conv.messages[i].role, content: conv.messages[i].content });
        }
        // Add a new alternate placeholder for streaming
        msg.alternates.push({ content: '', timestamp: Date.now() });
        msg.selected = msg.alternates.length - 1;
        msg.content = '';
        saveState();
        renderMessages();
        // Stream new alternate
        await streamAssistantResponse({ messages: [msg] }, contextMessages, 0, {
            signal: getAbortController().signal,
            onChunk: chunk => {
                msg.alternates[msg.selected].content += chunk;
                msg.content = msg.alternates[msg.selected].content;
                saveState();
                renderMessages();
            }
        });
        window.isGenerating = false;
        if (sendBtn) {
            sendBtn.innerHTML = 'Send';
            sendBtn.title = 'Send message';
            sendBtn.classList.remove('stop-btn');
            sendBtn.disabled = false;
        }
        saveState();
        renderMessages();
    } else if (msg && msg.role === 'user') {
        // If last message is user, generate a new assistant message as if user just sent it
        const contextMessages = [];
        if (conv.systemPrompt && conv.systemPrompt.trim()) {
            contextMessages.push({ role: 'system', content: conv.systemPrompt });
        }
        for (let i = 0; i <= idx; i++) {
            contextMessages.push({ role: conv.messages[i].role, content: conv.messages[i].content });
        }
        // Add a new assistant message placeholder
        const newMsg = { role: 'assistant', content: '', alternates: [{ content: '', timestamp: Date.now() }], selected: 0 };
        conv.messages.splice(idx + 1, 0, newMsg);
        saveState();
        renderMessages();
        await streamAssistantResponse(conv, contextMessages, idx + 1, {
            signal: getAbortController().signal,
            onChunk: chunk => {
                newMsg.alternates[0].content += chunk;
                newMsg.content = newMsg.alternates[0].content;
                saveState();
                renderMessages();
            }
        });
        window.isGenerating = false;
        if (sendBtn) {
            sendBtn.innerHTML = 'Send';
            sendBtn.title = 'Send message';
            sendBtn.classList.remove('stop-btn');
            sendBtn.disabled = false;
        }
        saveState();
        renderMessages();
    }
    setIsGenerating(false);
}

// Make handler available globally for render.js
window.onRegenerateMessage = onRegenerateMessage;
