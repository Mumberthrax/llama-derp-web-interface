// UI logic for chatbot interface
import { state, createPendingConversation, promotePendingConversation, discardPendingConversation, addMessage, clearMessages, addConversation, setActiveConversation, getActiveConversation, saveState, loadState, renameConversation, deleteConversation, updateConversationSettings, toggleSidebarCollapsed, setIsGenerating, getIsGenerating } from './state.js';
import { sendMessage } from './api.js';
import { onConversationEntryClick, onOptionsButtonClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick } from './eventHandlers.js';
import { renderSidebar, renderTitleBar, renderMessages } from './render.js';
import { applyPromptReplacements } from './promptReplacements.js';
import { dbClear } from './db.js';

// Module-level abortController (runtime only, not part of state)
let abortController = null;

// Top-level stopGeneration function for use throughout the app
function stopGeneration() {
    if (abortController) abortController.abort();
    setSendState(false);
}

function setSendState(generating) {
    setIsGenerating(generating);
    const sendBtn = document.getElementById('send-btn');
    if (!sendBtn) return;
    if (generating) {
        sendBtn.innerHTML = '<span style="font-size:1.35em;line-height:1;">&#9632;</span>';
        sendBtn.title = 'Stop generation';
        sendBtn.classList.add('stop-btn');
        sendBtn.disabled = false;
    } else {
        sendBtn.innerHTML = 'Send';
        sendBtn.title = 'Send message';
        sendBtn.classList.remove('stop-btn');
        sendBtn.disabled = false;
    }
}

export { stopGeneration, setSendState };

export function getAbortController() {
    return abortController;
}
export function setAbortController(ctrl) {
    abortController = ctrl;
}

/**
 * Handle send button click or enter in input
 */
export function setupInput() {
    const input = document.getElementById('chat-input');
    input && input.focus();
    const sendBtn = document.getElementById('send-btn');
    if (!input || !sendBtn) {
        return;
    }
    async function send() {
        const text = input.value.trim();
        let activeConv = getActiveConversation();
        // If no active conversation for selected character, use or promote pending conversation
        let promoted = false;
        if (!activeConv || activeConv.characterId !== state.selectedCharacterId) {
            if (state.pendingConversation) {
                // Promote pending to real
                const conv = promotePendingConversation();
                activeConv = conv;
                promoted = true;
            } else {
                // Fallback: create new conversation
                const convId = addConversation(state.selectedCharacterId);
                state.activeConversationId = convId;
                saveState();
                renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
                renderTitleBar(onOptionsButtonClick);
                renderMessages();
                activeConv = getActiveConversation();
            }
        }
        if (!text) return;
        if (!activeConv) return;
        addMessage('user', text);
        // Finalize any alternates in previous assistant message
        if (activeConv.messages.length >= 2) {
            const prevMsg = activeConv.messages[activeConv.messages.length - 2];
            if (prevMsg.role === 'assistant' && prevMsg.alternates && prevMsg.alternates.length > 1) {
                prevMsg.alternates = [prevMsg.alternates[prevMsg.selected]];
                prevMsg.selected = 0;
            }
        }
        saveState();
        // If we just promoted a conversation, re-render the sidebar to show it
        if (promoted) {
            renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
        }
        renderMessages();
        input.value = '';
        // Stream bot reply
        addMessage('assistant', '');
        saveState();
        renderMessages();
        const idx = activeConv.messages.length - 1;
        // System prompt as first message if present
        const messages = [];
        if (activeConv.systemPrompt && activeConv.systemPrompt.trim()) {
            messages.push({
                role: 'system',
                content: applyPromptReplacements(
                    activeConv.systemPrompt.trim(),
                    {
                        userName: activeConv.userName || 'User',
                        botName: activeConv.botName || 'Assistant'
                    }
                )
            });
        }
        messages.push(...activeConv.messages.slice(0, idx));
        setSendState(true);
        setAbortController(new AbortController());
        try {
            await streamAssistantResponse(activeConv, messages, idx);
        } catch (e) {
            // If aborted, ignore error
        }
        setSendState(false);
    }
    sendBtn.onclick = () => {
        if (getIsGenerating()) {
            stopGeneration();
        } else {
            send();
        }
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (getIsGenerating()) {
                stopGeneration();
            } else {
                send();
            }
        }
    });
}

/**
 * Initialize the UI
 */
export function initUI() {
    loadState();
    renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
    renderTitleBar(onOptionsButtonClick);
    renderMessages();
    setupInput();
    setupSidebarToggleBtn();
}

function setupSidebarToggleBtn() {
    const btn = document.getElementById('sidebar-toggle-btn');
    function updateBtn() {
        btn.innerHTML = '&#9776;'; // Hamburger icon always
        btn.title = state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }
    btn.onclick = () => {
        toggleSidebarCollapsed();
        renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
        renderTitleBar(onOptionsButtonClick);
        renderMessages();
        updateBtn();
    };
    updateBtn();
}

// Listen for character list changes and re-render sidebar with correct handlers
document.addEventListener('characterListChanged', () => {
    renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
});

// Listen for character selection changes to re-render sidebar and filter conversations
document.addEventListener('characterSelected', () => {
    // If there are no conversations for the selected character, create a pending conversation
    const filteredConvs = state.conversations.filter(c => c.characterId === state.selectedCharacterId);
    if (filteredConvs.length === 0) {
        state.pendingConversation = createPendingConversation(state.selectedCharacterId);
    } else {
        state.pendingConversation = null;
        state.activeConversationId = filteredConvs[filteredConvs.length-1].id;
    }
    saveState();
    renderSidebar(onConversationEntryClick, onNewChatClick, onSidebarCollapseClick, onEntryMenuClick);
    renderTitleBar(onOptionsButtonClick);
    renderMessages();
    setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) input.focus();
    }, 0);
});

// On switching characters, discard pending conversation if it exists and hasn't received a user message
window.addEventListener('beforeunload', () => {
    discardPendingConversation();
});

// Streams an assistant response into the conversation at the given index
// If custom onChunk is provided, use it; otherwise, default to msg.content update
export async function streamAssistantResponse(conv, contextMessages, assistantIdx, opts = {}) {
    const msg = conv.messages ? conv.messages[assistantIdx] : conv.messages === undefined ? undefined : conv.messages[assistantIdx];
    const onChunk = opts.onChunk || ((chunk) => {
        if (msg) {
            if (msg.alternates && typeof msg.selected === 'number') {
                msg.alternates[msg.selected].content += chunk;
            } else {
                msg.content += chunk;
            }
            saveState();
            renderMessages();
        }
    });
    await sendMessage(contextMessages, onChunk, opts.signal);
    saveState();
}

// Show the global settings modal for user preferences
export function showSettingsModal() {
    // Remove any existing modal
    let modal = document.getElementById('settings-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(30, 34, 40, 0.45)';
    modal.style.zIndex = '3200';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    // Modal content
    const content = document.createElement('div');
    content.className = 'character-modal-content';
    // Title
    const title = document.createElement('h2');
    title.textContent = 'Settings';
    content.appendChild(title);
    // User name
    const nameLabel = document.createElement('label');
    nameLabel.textContent = "Preferred User Name:";
    nameLabel.htmlFor = 'settings-user-name';
    content.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'settings-user-name';
    nameInput.value = window.localStorage.getItem('preferredUserName') || '';
    nameInput.placeholder = 'User';
    content.appendChild(nameInput);
    // Avatar
    const avatarLabel = document.createElement('label');
    avatarLabel.textContent = 'User Avatar:';
    avatarLabel.htmlFor = 'settings-user-avatar-file';
    content.appendChild(avatarLabel);
    // File input for image
    const avatarFileInput = document.createElement('input');
    avatarFileInput.id = 'settings-user-avatar-file';
    avatarFileInput.type = 'file';
    avatarFileInput.accept = 'image/*';
    content.appendChild(avatarFileInput);
    // Emoji picker (simple text input for emoji)
    const emojiLabel = document.createElement('label');
    emojiLabel.textContent = 'Or Emoji:';
    emojiLabel.htmlFor = 'settings-user-avatar-emoji';
    content.appendChild(emojiLabel);
    const emojiInput = document.createElement('input');
    emojiInput.id = 'settings-user-avatar-emoji';
    emojiInput.type = 'text';
    emojiInput.maxLength = 2;
    emojiInput.placeholder = '🙂';
    emojiInput.value = window.localStorage.getItem('preferredUserAvatar') && !window.localStorage.getItem('preferredUserAvatar').startsWith('data:') ? window.localStorage.getItem('preferredUserAvatar') : '';
    content.appendChild(emojiInput);
    // Preview area
    const avatarPreview = document.createElement('div');
    avatarPreview.style.margin = '8px 0';
    content.appendChild(avatarPreview);
    function updateAvatarPreview() {
        const stored = window.localStorage.getItem('preferredUserAvatar');
        if (avatarFileInput.files && avatarFileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                avatarPreview.innerHTML = `<img src="${e.target.result}" alt="avatar" style="width:48px;height:48px;">`;
            };
            reader.readAsDataURL(avatarFileInput.files[0]);
        } else if (emojiInput.value) {
            avatarPreview.innerHTML = `<span style="font-size:48px;">${emojiInput.value}</span>`;
        } else if (stored && !stored.startsWith('data:')) {
            avatarPreview.innerHTML = `<span style="font-size:48px;">${stored}</span>`;
        } else if (stored && stored.startsWith('data:')) {
            avatarPreview.innerHTML = `<img src="${stored}" alt="avatar" style="width:48px;height:48px;">`;
        } else {
            avatarPreview.innerHTML = '';
        }
    }
    avatarFileInput.addEventListener('change', updateAvatarPreview);
    emojiInput.addEventListener('input', updateAvatarPreview);
    updateAvatarPreview();
    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'character-confirm-btn';
    saveBtn.onclick = () => {
        const name = nameInput.value.trim() || 'User';
        // Save to localStorage
        window.localStorage.setItem('preferredUserName', name);
        // Prefer image file if selected
        const file = avatarFileInput.files && avatarFileInput.files[0];
        const saveAndApply = (avatarValue) => {
            window.localStorage.setItem('preferredUserAvatar', avatarValue);
            // Apply to all conversations (unless overridden)
            for (const conv of window.state.conversations) {
                // Only update if not overridden in the conversation options
                if (!conv.hasOwnProperty('userName') || !conv.userName || conv.userName === '' || conv.userName === window.localStorage.getItem('preferredUserName')) {
                    conv.userName = name;
                }
                if (!conv.hasOwnProperty('userAvatar') || !conv.userAvatar || conv.userAvatar === '' || conv.userAvatar === window.localStorage.getItem('preferredUserAvatar')) {
                    conv.userAvatar = avatarValue;
                }
            }
            if (window.saveState) window.saveState();
            if (window.renderMessages) window.renderMessages();
            modal.remove();
        };
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                saveAndApply(e.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            saveAndApply(emojiInput.value.trim());
        }
    };
    content.appendChild(saveBtn);
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'character-cancel-btn';
    cancelBtn.onclick = () => modal.remove();
    content.appendChild(cancelBtn);
    // Add Reset Everything button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Everything';
    resetBtn.className = 'confirm-modal-btn confirm-modal-btn-danger';
    resetBtn.style.marginTop = '30px';
    resetBtn.onclick = () => {
        import('./ui.js').then(({ showConfirmModal }) => {
            showConfirmModal({
                title: 'Reset Everything?',
                message: 'This will delete ALL conversations, characters, and settings. This cannot be undone. Continue?',
                buttons: [
                    { label: 'Delete All Data', value: 'reset', style: 'danger' },
                    { label: 'Cancel', value: 'cancel', style: 'cancel' }
                ]
            }, async (result) => {
                if (result === 'reset') {
                    await dbClear('conversations');
                    await dbClear('characters');
                    localStorage.removeItem('chatbot_settings');
                    // Optionally clear other app-specific localStorage keys
                    await loadState();
                    window.location.reload();
                }
            });
        });
    };
    content.appendChild(resetBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

// Data-oriented, reusable confirmation modal
export function showConfirmModal(config, callback) {
    // Remove any existing modal
    let modal = document.getElementById('confirm-modal');
    if (modal) modal.remove();
    // Overlay
    modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(30, 34, 40, 0.45)';
    modal.style.zIndex = '4000';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    // Modal content
    const content = document.createElement('div');
    content.className = 'confirm-modal-content';
    if (config.title) {
        const title = document.createElement('h3');
        title.className = 'confirm-modal-title';
        title.textContent = config.title;
        content.appendChild(title);
    }
    if (config.message) {
        const msg = document.createElement('div');
        msg.className = 'confirm-modal-message';
        msg.textContent = config.message;
        content.appendChild(msg);
    }
    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'confirm-modal-buttons';
    (config.buttons || []).forEach(btnCfg => {
        const btn = document.createElement('button');
        btn.textContent = btnCfg.label;
        btn.className = 'confirm-modal-btn' + (btnCfg.style ? ' confirm-modal-btn-' + btnCfg.style : '');
        btn.onclick = () => {
            modal.remove();
            callback(btnCfg.value);
        };
        btnRow.appendChild(btn);
    });
    content.appendChild(btnRow);
    // Cancel on overlay click or Escape key
    modal.onclick = e => { if (e.target === modal) { modal.remove(); callback('cancel'); } };
    document.addEventListener('keydown', function escHandler(ev) {
        if (ev.key === 'Escape') { modal.remove(); callback('cancel'); document.removeEventListener('keydown', escHandler); }
    });
    modal.appendChild(content);
    document.body.appendChild(modal);
}
