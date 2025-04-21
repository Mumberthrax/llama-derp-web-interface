// Rendering functions for chatbot UI
import { getActiveConversation, state, addConversation, setActiveConversation, saveState, renameConversation, deleteConversation } from './state.js';
import { showCharacterSelectModal, showCharacterEditModal } from './character.js';
import { showSettingsModal } from './ui.js';

function stripNamePrefix(msg, name) {
    const prefix = name + ': ';
    if (msg.startsWith(prefix)) {
        return msg.slice(prefix.length);
    }
    return msg;
}

export function renderTitleBar(onOptionsButtonClick) {
    const bar = document.getElementById('chat-title-bar');
    const conv = getActiveConversation();
    bar.innerHTML = '';
    if (!conv) return;
    const titleSpan = document.createElement('span');
    titleSpan.textContent = conv.title || 'Untitled';
    titleSpan.style.flex = '1 1 auto';
    bar.appendChild(titleSpan);
    // Options button
    const optsBtn = document.createElement('button');
    optsBtn.textContent = '⋮';
    optsBtn.className = 'chat-options-btn';
    optsBtn.title = 'Conversation options';
    optsBtn.onclick = onOptionsButtonClick;
    bar.appendChild(optsBtn);
}

function createMessageHeader(msg, idx, lastIdx, editIdx, activeConv, contentDiv) {
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    // Left section: name and timestamp
    const headerLeft = document.createElement('span');
    headerLeft.className = 'message-header-left';
    // Name
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = msg.role === 'user' ? (activeConv.userName || window.localStorage.getItem('preferredUserName') || 'You') : (activeConv.botName || 'Assistant');
    headerLeft.appendChild(name);
    // Timestamp
    const time = document.createElement('span');
    time.className = 'timestamp';
    if (msg.timestamp) {
        const d = new Date(msg.timestamp);
        time.textContent = d.toLocaleString();
    } else {
        time.textContent = '';
    }
    headerLeft.appendChild(time);
    headerDiv.appendChild(headerLeft);
    // Controls
    headerDiv.appendChild(createMessageControls(msg, idx, lastIdx, editIdx, contentDiv));
    return headerDiv;
}

function createMessageControls(msg, idx, lastIdx, editIdx, contentDiv) {
    const controlsDiv = document.createElement('span');
    controlsDiv.className = 'message-controls';
    // Regenerate button (only for latest message)
    if (idx === lastIdx && editIdx !== idx) {
        const regenBtn = document.createElement('button');
        regenBtn.className = 'regen-btn';
        regenBtn.title = 'Regenerate message';
        regenBtn.innerHTML = '⟳';
        regenBtn.onclick = () => {
            if (typeof window.onRegenerateMessage === 'function') {
                window.onRegenerateMessage(idx);
            }
        };
        controlsDiv.appendChild(regenBtn);
    }
    if (editIdx === idx) {
        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.title = 'Save';
        saveBtn.innerHTML = '✔';
        saveBtn.onclick = () => {
            const textarea = contentDiv.querySelector('textarea');
            // Support alternates
            if (msg.alternates && typeof msg.selected === 'number') {
                msg.alternates[msg.selected].content = textarea.value;
            } else {
                msg.content = textarea.value;
            }
            saveState();
            renderMessages();
        };
        controlsDiv.appendChild(saveBtn);
        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.title = 'Cancel';
        cancelBtn.innerHTML = '✖';
        cancelBtn.onclick = () => renderMessages();
        controlsDiv.appendChild(cancelBtn);
    } else {
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.title = 'Edit message';
        editBtn.innerHTML = '✎';
        editBtn.onclick = () => renderMessages(idx);
        controlsDiv.appendChild(editBtn);
    }
    // Options button
    const optionsBtn = document.createElement('button');
    optionsBtn.className = 'options-btn';
    optionsBtn.title = 'Message options';
    optionsBtn.innerHTML = '⋮';
    optionsBtn.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.message-entry-menu').forEach(el => el.remove());
        const menu = document.createElement('div');
        menu.className = 'message-entry-menu';
        const rect = optionsBtn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 2) + 'px';
        menu.style.left = (rect.right - 120) + 'px';
        menu.style.minWidth = '120px';
        menu.style.zIndex = 1001;
        // Delete option
        const del = document.createElement('div');
        del.textContent = 'Delete';
        del.className = 'menu-delete';
        del.onclick = (ev) => {
            ev.stopPropagation();
            if (confirm('Delete this message?')) {
                const activeConv = getActiveConversation();
                activeConv.messages.splice(idx, 1);
                saveState();
                renderMessages();
            }
            menu.remove();
        };
        menu.appendChild(del);
        document.body.appendChild(menu);
        setTimeout(() => {
            document.addEventListener('click', function handler() {
                menu.remove();
                document.removeEventListener('click', handler);
            });
        }, 0);
    };
    controlsDiv.appendChild(optionsBtn);
    return controlsDiv;
}

function createMessageTextOrTextarea(msg, idx, editIdx) {
    if (editIdx === idx) {
        const textarea = document.createElement('textarea');
        textarea.className = 'edit-textarea';
        // Support alternates
        let content = msg.content;
        if (msg.alternates && typeof msg.selected === 'number') {
            content = msg.alternates[msg.selected]?.content || '';
        }
        textarea.value = content;
        textarea.rows = 3;
        textarea.style.width = '100%';
        textarea.style.fontFamily = 'inherit';
        textarea.style.fontSize = '1em';
        textarea.style.background = '#23272e';
        textarea.style.color = '#eee';
        textarea.style.border = '1.5px solid #3af';
        textarea.style.borderRadius = '6px';
        textarea.style.padding = '8px 12px';
        textarea.style.marginTop = '2px';
        textarea.style.resize = 'vertical';
        setTimeout(() => textarea.focus(), 0);
        return textarea;
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'text-with-alternates';
        const text = document.createElement('div');
        text.className = 'text';
        // Show selected alternate if present
        let displayContent = msg.content;
        if (msg.alternates && typeof msg.selected === 'number') {
            displayContent = msg.alternates[msg.selected]?.content || '';
        }
        // Strip name prefix for display
        const activeConv = getActiveConversation();
        let name = '';
        if (msg.role === 'user') {
            name = (activeConv && activeConv.userName) ? activeConv.userName : 'User';
        } else if (msg.role === 'assistant') {
            name = (activeConv && activeConv.botName) ? activeConv.botName : 'Assistant';
        }
        // Only strip prefix if it appears exactly once at the start
        if (displayContent.startsWith(name + ': ')) {
            displayContent = displayContent.slice((name + ': ').length);
        }
        text.innerHTML = displayContent.replace(/\n/g, '<br>');
        wrapper.appendChild(text);
        // Alternates navigation (below text, only for last assistant message with alternates)
        const lastIdx = activeConv ? activeConv.messages.length - 1 : -1;
        if (msg.role === 'assistant' && msg.alternates && msg.alternates.length > 1 && idx === lastIdx) {
            const navDiv = document.createElement('div');
            navDiv.className = 'alternates-nav';
            navDiv.style.display = 'flex';
            navDiv.style.justifyContent = 'center';
            // Left arrow
            const leftBtn = document.createElement('button');
            leftBtn.className = 'alt-left-btn';
            leftBtn.title = 'Previous alternate';
            leftBtn.textContent = '<';
            leftBtn.onclick = (e) => {
                e.stopPropagation();
                if (msg.selected > 0) {
                    msg.selected--;
                    saveState();
                    renderMessages();
                }
            };
            navDiv.appendChild(leftBtn);
            // Indicator n/m
            const altIndicator = document.createElement('span');
            altIndicator.className = 'alt-indicator';
            altIndicator.textContent = `${msg.selected + 1}/${msg.alternates.length}`;
            navDiv.appendChild(altIndicator);
            // Right arrow
            const rightBtn = document.createElement('button');
            rightBtn.className = 'alt-right-btn';
            rightBtn.title = 'Next alternate';
            rightBtn.textContent = '>';
            rightBtn.onclick = (e) => {
                e.stopPropagation();
                if (msg.selected < msg.alternates.length - 1) {
                    msg.selected++;
                    saveState();
                    renderMessages();
                }
            };
            navDiv.appendChild(rightBtn);
            wrapper.appendChild(navDiv);
        }
        return wrapper;
    }
}

export function renderMessages(editIdx = null) {
    const chatArea = document.getElementById('chat-messages');
    chatArea.innerHTML = '';
    // Prefer pendingConversation if it exists for the selected character
    let conv = null;
    if (state.pendingConversation && state.pendingConversation.characterId === state.selectedCharacterId) {
        conv = state.pendingConversation;
    } else {
        conv = getActiveConversation();
        if (!conv || conv.characterId !== state.selectedCharacterId) {
            conv = null;
        }
    }
    if (!conv) return;
    // Render all messages in the conversation (greeting is always real if present)
    const messages = conv.messages;
    for (let i = 0; i < messages.length; ++i) {
        const msg = messages[i];
        const isAssistant = msg.role === 'assistant';
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message ' + (isAssistant ? 'assistant' : 'user');
        let avatar;
        if (isAssistant) {
            const char = state.characters.find(c => c.id === conv.characterId);
            if (char && char.avatar && char.avatar.startsWith('data:image')) {
                avatar = document.createElement('img');
                avatar.src = char.avatar;
                avatar.alt = 'Avatar';
                avatar.className = 'avatar';
            } else {
                avatar = document.createElement('span');
                avatar.className = 'avatar';
                avatar.textContent = (char && char.avatar) ? char.avatar : '🤖';
            }
        } else {
            // Use userAvatar logic similar to assistant avatar
            let userAvatar = conv.userAvatar || window.localStorage.getItem('preferredUserAvatar') || '';
            if (userAvatar && userAvatar.startsWith('data:image')) {
                avatar = document.createElement('img');
                avatar.src = userAvatar;
                avatar.alt = 'Avatar';
                avatar.className = 'avatar';
            } else if (userAvatar) {
                avatar = document.createElement('span');
                avatar.className = 'avatar';
                avatar.textContent = userAvatar;
            } else {
                avatar = document.createElement('span');
                avatar.className = 'avatar';
                avatar.textContent = '🧑';
            }
        }
        msgDiv.appendChild(avatar);
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.appendChild(createMessageHeader(msg, i, messages.length - 1, editIdx, conv, contentDiv));
        contentDiv.appendChild(createMessageTextOrTextarea(msg, i, editIdx));
        msgDiv.appendChild(contentDiv);
        chatArea.appendChild(msgDiv);
    }
    chatArea.scrollTop = chatArea.scrollHeight;
}

export function renderSidebar(
    onConversationEntryClick,
    onNewChatClick,
    onSidebarCollapseClick,
    onEntryMenuClick
) {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';
    if (state.sidebarCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
        const mainLayout = document.getElementById('main-layout');
        if (mainLayout) mainLayout.classList.add('sidebar-collapsed');
        return;
    } else {
        sidebar.classList.remove('sidebar-collapsed');
        const mainLayout = document.getElementById('main-layout');
        if (mainLayout) mainLayout.classList.remove('sidebar-collapsed');
    }
    // Sidebar header row (title on its own line)
    const headerRow = document.createElement('div');
    headerRow.className = 'sidebar-header-row';
    // Conversations header (full width)
    const title = document.createElement('div');
    title.className = 'sidebar-header';
    title.textContent = 'Conversations';
    headerRow.appendChild(title);
    // New chat button (full width, below header)
    const newChatBtn = document.createElement('button');
    newChatBtn.id = 'new-chat-btn';
    newChatBtn.textContent = '+ New Chat';
    newChatBtn.onclick = onNewChatClick;
    headerRow.appendChild(newChatBtn);
    sidebar.appendChild(headerRow);
    // Conversation list container for spacing
    const listContainer = document.createElement('div');
    listContainer.style.marginTop = '8px';
    listContainer.style.flex = '1 1 auto'; // Allow list to grow and shrink
    listContainer.style.overflowY = 'auto';
    // Only show conversations for the selected character
    const filteredConvs = state.conversations.filter(conv => conv.characterId === state.selectedCharacterId);
    for (const conv of [...filteredConvs].slice().reverse()) {
        const entry = document.createElement('div');
        entry.className = 'sidebar-entry' + (conv.id === state.activeConversationId ? ' active' : '');
        const titleSpan = document.createElement('span');
        titleSpan.textContent = conv.title || 'Untitled';
        titleSpan.className = 'conv-title';
        entry.appendChild(titleSpan);
        // Three dots menu (hidden by default, shown on hover)
        const menuBtn = document.createElement('button');
        menuBtn.className = 'sidebar-entry-menu-btn';
        menuBtn.title = 'Conversation actions';
        menuBtn.innerHTML = '⋮';
        menuBtn.onclick = (e) => onEntryMenuClick(conv.id, e);
        entry.appendChild(menuBtn);
        entry.onclick = () => onConversationEntryClick(conv.id);
        listContainer.appendChild(entry);
    }
    sidebar.appendChild(listContainer);
    // Add persistent bottom area
    const bottomArea = document.createElement('div');
    bottomArea.style.display = 'flex';
    bottomArea.style.flexDirection = 'column';
    bottomArea.style.gap = '8px';
    bottomArea.style.margin = '16px 0 8px 0';
    bottomArea.style.alignItems = 'stretch';
    bottomArea.style.width = '100%';
    // Divider
    const divider = document.createElement('div');
    divider.className = 'sidebar-divider';
    divider.style.borderTop = '1px solid #444';
    divider.style.marginBottom = '8px';
    bottomArea.appendChild(divider);
    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'settings-btn';
    settingsBtn.innerHTML = '⚙️ Settings';
    settingsBtn.className = 'sidebar-bottom-btn';
    settingsBtn.onclick = showSettingsModal;
    bottomArea.appendChild(settingsBtn);
    // Characters button
    const bottomBtn = document.createElement('button');
    bottomBtn.id = 'character-btn';
    bottomBtn.textContent = 'Characters';
    bottomBtn.className = 'sidebar-bottom-btn';
    bottomBtn.onclick = showCharacterSelectModal;
    bottomArea.appendChild(bottomBtn);
    sidebar.appendChild(bottomArea);
}
