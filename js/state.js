// Centralized app state (data-oriented)

// Each conversation: {id, title, characterId, messages: [{role, content, timestamp}], systemPrompt, userName, botName}
import { applyPromptReplacements } from './promptReplacements.js';
import { dbPut, dbGetAll, dbDelete } from './db.js';

export const state = {
    conversations: [
        { id: 1, title: getTimestampTitle(), characterId: 'fox', messages: [], systemPrompt: '', userName: 'You', botName: 'Assistant', userAvatar: '' }
    ],
    activeConversationId: 1,
    nextConvId: 2,
    sidebarCollapsed: false,
    isGenerating: false,
    // Character selection state
    characters: [
        { id: 'fox', name: 'Fox', avatar: '🦊' },
        { id: 'alice', name: 'Alice', avatar: '👧' },
        { id: 'robot', name: 'Robot', avatar: '🤖' },
        { id: 'cat', name: 'Cat', avatar: '🐱' }
    ],
    selectedCharacterId: 'fox',
    pendingConversation: null // holds a temporary conversation object, not persisted
};

function getTimestampTitle() {
    const now = new Date();
    return now.toLocaleString();
}

export function getActiveConversation() {
    return state.conversations.find(c => c.id === state.activeConversationId);
}

export function setActiveConversation(id) {
    state.activeConversationId = id;
}

export function addConversation(characterId = state.selectedCharacterId) {
    const id = state.nextConvId++;
    // Use preferred userName and userAvatar from localStorage if available
    let preferredUserName = window.localStorage.getItem('preferredUserName') || 'User';
    let preferredUserAvatar = window.localStorage.getItem('preferredUserAvatar') || '';
    const char = state.characters.find(c => c.id === characterId);
    let botName = (char && char.name) ? char.name : 'Assistant';
    state.conversations.push({ id, title: getTimestampTitle(), characterId, messages: [], systemPrompt: '', userName: preferredUserName, userAvatar: preferredUserAvatar, botName });
    return id;
}

export function renameConversation(id, newTitle) {
    const conv = state.conversations.find(c => c.id === id);
    if (conv) conv.title = newTitle;
}

export function deleteConversation(id) {
    const idx = state.conversations.findIndex(c => c.id === id);
    if (idx !== -1) {
        state.conversations.splice(idx, 1);
        // If deleted active, switch to latest or none
        if (state.activeConversationId === id) {
            if (state.conversations.length > 0) {
                state.activeConversationId = state.conversations[state.conversations.length-1].id;
            } else {
                // Add a fresh one
                addConversation();
                state.activeConversationId = state.conversations[0].id;
            }
        }
    }
}

export function updateConversationSettings(id, {userName, botName, systemPrompt}) {
    const conv = state.conversations.find(c => c.id === id);
    if (conv) {
        if (typeof userName === 'string') conv.userName = userName;
        if (typeof botName === 'string') conv.botName = botName;
        if (typeof systemPrompt === 'string') conv.systemPrompt = systemPrompt;
        // if (typeof systemPrompt === 'string') {
        //     conv.systemPrompt = applyPromptReplacements(systemPrompt, {
        //         userName: conv.userName,
        //         botName: conv.botName
        //     });
        // }
    }
}

// For compatibility with old code (single-message mode)
export function addMessage(role, content) {
    const conv = getActiveConversation();
    if (conv) {
        const now = new Date();
        let namePrefix = '';
        if (role === 'user') {
            namePrefix = (conv.userName || 'User') + ': ';
        } else if (role === 'assistant') {
            namePrefix = (conv.botName || 'Assistant') + ': ';
        }
        let contentWithPrefix = content;
        // Only add prefix if not already present (for both roles)
        if (!content.startsWith(namePrefix)) {
            contentWithPrefix = namePrefix + content;
        }
        conv.messages.push({
            role,
            content: typeof contentWithPrefix === 'string' ? contentWithPrefix : '',
            timestamp: now.toISOString()
        });
    }
}

export function clearMessages() {
    const conv = getActiveConversation();
    if (conv) conv.messages.length = 0;
}

// Helper: upgrade assistant messages to alternates format if needed
export function ensureAssistantAlternates(msg) {
    if (msg.role === 'assistant') {
        if (!msg.alternates) {
            msg.alternates = [{ content: typeof msg.content === 'string' ? msg.content : '', timestamp: msg.timestamp || Date.now() }];
            msg.selected = 0;
            msg.content = typeof msg.content === 'string' ? msg.content : '';
        }
    }
}

// Helper to create a new conversation object for a character, with greeting if present
export function createPendingConversation(characterId) {
    const char = state.characters.find(c => c.id === characterId);
    let preferredUserName = window.localStorage.getItem('preferredUserName') || 'User';
    let preferredUserAvatar = window.localStorage.getItem('preferredUserAvatar') || '';
    const conv = {
        id: 'pending', // special id
        title: getTimestampTitle(),
        characterId,
        messages: [],
        systemPrompt: '',
        systemPromptTemplate: '',
        userName: preferredUserName,
        userAvatar: preferredUserAvatar,
        botName: (char && char.name) ? char.name : 'Assistant'
    };
    if (char && char.greeting && char.greeting.trim()) {
        conv.messages.push({
            role: 'assistant',
            content: char.greeting.trim(),
            timestamp: Date.now()
        });
    }
    // Set systemPrompt default from character if available
    if (char && char.systemPrompt && char.systemPrompt.trim()) {
        // Store the original template with placeholders for editing in the modal
        conv.systemPromptTemplate = char.systemPrompt.trim();
        // Store the resolved system prompt for use in context
        conv.systemPrompt = applyPromptReplacements(char.systemPrompt.trim(), {
            userName: preferredUserName,
            botName: (char && char.name) ? char.name : 'Assistant'
        });
    }
    return conv;
}

// Helper to promote pendingConversation to real conversation
export function promotePendingConversation() {
    if (state.pendingConversation) {
        const conv = { ...state.pendingConversation, id: state.nextConvId++ };
        state.conversations.push(conv);
        state.activeConversationId = conv.id;
        state.pendingConversation = null;
        return conv;
    }
    return null;
}

// Helper to discard pendingConversation
export function discardPendingConversation() {
    state.pendingConversation = null;
}

// Persistence: save/load state to IndexedDB and localStorage
export async function saveState() {
    try {
        // Save all conversations
        for (const conv of state.conversations) {
            await dbPut('conversations', conv);
        }
        // Remove deleted conversations
        const storedConvs = await dbGetAll('conversations');
        for (const stored of storedConvs) {
            if (!state.conversations.find(c => c.id === stored.id)) {
                await dbDelete('conversations', stored.id);
            }
        }
        // Save all characters
        for (const char of state.characters) {
            await dbPut('characters', char);
        }
        // Remove deleted characters
        const storedChars = await dbGetAll('characters');
        for (const stored of storedChars) {
            if (!state.characters.find(c => c.id === stored.id)) {
                await dbDelete('characters', stored.id);
            }
        }
        // Keep small settings in localStorage for now
        localStorage.setItem('chatbot_settings', JSON.stringify({
            activeConversationId: state.activeConversationId,
            nextConvId: state.nextConvId,
            sidebarCollapsed: state.sidebarCollapsed,
            selectedCharacterId: state.selectedCharacterId
        }));
    } catch (e) {
        console.error('Failed to save state:', e);
        if (e.name === 'QuotaExceededError' || e.message.includes('QuotaExceededError')) {
            import('./ui.js').then(({ showConfirmModal }) => {
                showConfirmModal({
                    title: 'Storage Limit Reached',
                    message: 'Your browser storage is full. Some data could not be saved.\n\nTry deleting old conversations or clearing storage in your browser settings.',
                    buttons: [
                        { label: 'OK', value: 'ok', style: 'default' }
                    ]
                }, () => {});
            });
        }
    }
}

// Removed migration code for old localStorage 'chatbot_state'
// (Confirmed migrated by user)

// Load conversations and characters from IndexedDB and localStorage
export async function loadState() {
    try {
        state.conversations = await dbGetAll('conversations');
        state.characters = await dbGetAll('characters');
        const raw = localStorage.getItem('chatbot_settings');
        if (raw) {
            const data = JSON.parse(raw);
            state.activeConversationId = data.activeConversationId;
            state.nextConvId = data.nextConvId;
            state.sidebarCollapsed = data.sidebarCollapsed;
            state.selectedCharacterId = data.selectedCharacterId;
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
}

export function toggleSidebarCollapsed() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
}

export function setIsGenerating(val) {
    state.isGenerating = val;
}

export function getIsGenerating() {
    return state.isGenerating;
}
