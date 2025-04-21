// character.js
// Data-oriented logic for character selection and editing UI

import { state, saveState } from './state.js';
import { showConfirmModal } from './ui.js';

export function showCharacterSelectModal() {
    // Remove any existing modal
    let modal = document.getElementById('character-select-modal');
    if (modal) modal.remove();
    // Modal overlay
    modal = document.createElement('div');
    modal.id = 'character-select-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(30, 34, 40, 0.45)';
    modal.style.zIndex = '3000';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.onclick = null;
    // Modal content
    const content = document.createElement('div');
    content.className = 'character-modal-content';
    // Title
    const title = document.createElement('h2');
    title.textContent = 'Select Character';
    title.style.margin = '0 0 12px 0';
    content.appendChild(title);
    // Search/filter input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'character-search-input';
    searchInput.placeholder = 'Search characters...';
    searchInput.style.marginBottom = '10px';
    content.appendChild(searchInput);

    // Character list (gallery grid)
    const charList = document.createElement('div');
    charList.className = 'character-list';
    let selectedId = state.selectedCharacterId;
    let filteredCharacters = state.characters.slice();

    function renderCharacterGrid() {
        charList.innerHTML = '';
        if (Array.isArray(filteredCharacters) && filteredCharacters.length > 0) {
            filteredCharacters.forEach((char, idx) => {
                const entry = document.createElement('div');
                entry.className = 'character-entry' + (char.id === selectedId ? ' selected' : '');
                entry.tabIndex = 0;
                entry.setAttribute('role', 'button');
                entry.setAttribute('aria-selected', char.id === selectedId ? 'true' : 'false');
                entry.onclick = () => {
                    selectedId = char.id;
                    [...charList.children].forEach(child => child.classList.remove('selected'));
                    entry.classList.add('selected');
                    // Immediately confirm selection
                    state.selectedCharacterId = selectedId;
                    document.dispatchEvent(new CustomEvent('characterListChanged'));
                    document.dispatchEvent(new CustomEvent('characterSelected'));
                    modal.remove();
                };
                // Avatar (fills top of entry, rectangular)
                let avatarWrapper;
                let avatar;
                if (char.avatar && (char.avatar.startsWith('data:image') || /\.(png|jpg|jpeg)$/i.test(char.avatar))) {
                    avatarWrapper = document.createElement('div');
                    avatarWrapper.className = 'avatar';
                    avatar = document.createElement('img');
                    avatar.src = char.avatar;
                    avatar.alt = 'Avatar';
                    avatar.className = 'avatar';
                } else {
                    avatarWrapper = document.createElement('div');
                    avatarWrapper.className = 'avatar avatar-emoji';
                    avatar = document.createElement('span');
                    avatar.textContent = char.avatar || '👤';
                }
                avatarWrapper.appendChild(avatar);
                entry.appendChild(avatarWrapper);
                // Edit/Delete dropdown button (⋮), positioned top-right
                const menuBtn = document.createElement('button');
                menuBtn.className = 'character-menu-btn';
                menuBtn.title = 'Character options';
                menuBtn.innerHTML = '⋮';
                menuBtn.style.position = 'absolute';
                menuBtn.style.top = '6px';
                menuBtn.style.right = '6px';
                menuBtn.style.zIndex = 10;
                entry.style.position = 'relative'; // Ensure parent is positioned
                entry.appendChild(menuBtn);
                menuBtn.onclick = (event) => {
                    event.stopPropagation();
                    // Close any open menu
                    document.querySelectorAll('.sidebar-entry-menu').forEach(el => el.remove());
                    // Attach menu to the character entry card
                    const card = menuBtn.closest('.character-entry');
                    card.style.position = 'relative'; // Ensure relative positioning
                    const menu = document.createElement('div');
                    menu.className = 'sidebar-entry-menu';
                    menu.style.position = 'absolute';
                    menu.style.left = (menuBtn.offsetLeft) + 'px';
                    menu.style.top = (menuBtn.offsetTop + menuBtn.offsetHeight + 2) + 'px';
                    // Menu options
                    const editOpt = document.createElement('div');
                    editOpt.textContent = 'Edit';
                    editOpt.onclick = (e) => {
                        e.stopPropagation();
                        menu.remove();
                        showCharacterEditModal({
                            mode: 'edit',
                            character: char,
                            onSave: (updatedChar) => {
                                state.characters[state.characters.findIndex(c => c.id === char.id)] = updatedChar;
                                saveState();
                                document.dispatchEvent(new CustomEvent('characterListChanged'));
                                showCharacterSelectModal();
                            }
                        });
                    };
                    const delOpt = document.createElement('div');
                    delOpt.textContent = 'Delete';
                    delOpt.className = 'menu-delete';
                    delOpt.onclick = (e) => {
                        e.stopPropagation();
                        menu.remove();
                        // Find conversations for this character
                        const charConvs = state.conversations.filter(c => c.characterId === char.id);
                        if (charConvs.length > 0) {
                            showConfirmModal({
                                title: `Delete character '${char.name}'?`,
                                message: `This character has ${charConvs.length} conversation(s). What would you like to do?`,
                                buttons: [
                                    { label: 'Delete Character and Conversations', value: 'all', style: 'danger' },
                                    { label: 'Delete Character Only', value: 'char', style: 'default' },
                                    { label: 'Cancel', value: 'cancel', style: 'cancel' }
                                ]
                            }, function(result) {
                                if (result === 'all') {
                                    state.characters = state.characters.filter(c => c.id !== char.id);
                                    state.conversations = state.conversations.filter(c => c.characterId !== char.id);
                                    saveState();
                                    document.dispatchEvent(new CustomEvent('characterListChanged'));
                                    showCharacterSelectModal();
                                } else if (result === 'char') {
                                    state.characters = state.characters.filter(c => c.id !== char.id);
                                    saveState();
                                    document.dispatchEvent(new CustomEvent('characterListChanged'));
                                    showCharacterSelectModal();
                                }
                                // else: cancel, do nothing
                            });
                        } else {
                            showConfirmModal({
                                title: `Delete character '${char.name}'?`,
                                message: `Are you sure you want to delete this character?`,
                                buttons: [
                                    { label: 'Delete', value: 'delete', style: 'danger' },
                                    { label: 'Cancel', value: 'cancel', style: 'cancel' }
                                ]
                            }, function(result) {
                                if (result === 'delete') {
                                    state.characters = state.characters.filter(c => c.id !== char.id);
                                    saveState();
                                    document.dispatchEvent(new CustomEvent('characterListChanged'));
                                    showCharacterSelectModal();
                                }
                                // else: cancel, do nothing
                            });
                        }
                    };
                    menu.appendChild(editOpt);
                    menu.appendChild(delOpt);
                    card.appendChild(menu);
                    // Close menu on click elsewhere
                    setTimeout(() => {
                        document.addEventListener('click', function handler() {
                            menu.remove();
                            document.removeEventListener('click', handler);
                        });
                    }, 0);
                };
                // Name below avatar
                const nameSpan = document.createElement('span');
                nameSpan.className = 'character-name';
                nameSpan.textContent = char.name;
                entry.appendChild(nameSpan);
                charList.appendChild(entry);
            });
        } else {
            // No characters match
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No characters found.';
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.padding = '20px 0';
            charList.appendChild(emptyMsg);
        }
    }

    // Filter logic
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        filteredCharacters = state.characters.filter(c => c.name.toLowerCase().includes(q));
        renderCharacterGrid();
    });

    renderCharacterGrid();
    content.appendChild(charList);
    // Add Character button
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add Character';
    addBtn.className = 'character-add-btn';
    addBtn.onclick = () => {
        showCharacterEditModal({
            mode: 'add',
            character: {},
            onSave: (newChar) => {
                // Assign a unique id
                newChar.id = 'char_' + Date.now();
                state.characters.push(newChar);
                state.selectedCharacterId = newChar.id;
                saveState();
                document.dispatchEvent(new CustomEvent('characterListChanged'));
                showCharacterSelectModal();
            }
        });
    };
    content.appendChild(addBtn);
    // Cancel button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'character-cancel-btn';
    closeBtn.onclick = () => modal.remove();
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

export function showCharacterEditModal({
    mode = 'add', // 'add' or 'edit'
    character = {},
    onSave,
    onCancel
} = {}) {
    // Remove any existing modal
    let modal = document.getElementById('character-edit-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'character-edit-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(30, 34, 40, 0.45)';
    modal.style.zIndex = '3100';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.onclick = null;
    // Modal content
    const content = document.createElement('div');
    content.className = 'character-modal-content';
    // Title
    const title = document.createElement('h2');
    title.textContent = mode === 'add' ? 'Add Character' : 'Edit Character';
    content.appendChild(title);
    // Name
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name:';
    nameLabel.htmlFor = 'character-edit-name';
    content.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.id = 'character-edit-name';
    nameInput.type = 'text';
    nameInput.value = character.name || '';
    nameInput.placeholder = 'Character name';
    content.appendChild(nameInput);
    // Avatar
    const avatarLabel = document.createElement('label');
    avatarLabel.textContent = 'Avatar:';
    avatarLabel.htmlFor = 'character-edit-avatar-file';
    content.appendChild(avatarLabel);

    // File input for image
    const avatarFileInput = document.createElement('input');
    avatarFileInput.id = 'character-edit-avatar-file';
    avatarFileInput.type = 'file';
    avatarFileInput.accept = 'image/*';
    content.appendChild(avatarFileInput);

    // Emoji picker (simple text input for emoji)
    const emojiLabel = document.createElement('label');
    emojiLabel.textContent = 'Or Emoji:';
    emojiLabel.htmlFor = 'character-edit-avatar-emoji';
    content.appendChild(emojiLabel);

    const emojiInput = document.createElement('input');
    emojiInput.id = 'character-edit-avatar-emoji';
    emojiInput.type = 'text';
    emojiInput.maxLength = 2; // Allow 1 emoji
    emojiInput.placeholder = '🦊';
    emojiInput.value = character.avatar && !character.avatar.startsWith('data:') ? character.avatar : '';
    content.appendChild(emojiInput);

    // Preview area
    const avatarPreview = document.createElement('div');
    avatarPreview.style.margin = '8px 0';
    content.appendChild(avatarPreview);

    // Preview logic
    function updateAvatarPreview() {
        if (avatarFileInput.files && avatarFileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                avatarPreview.innerHTML = `<img src="${e.target.result}" alt="avatar" style="width:48px;height:48px;">`;
            };
            reader.readAsDataURL(avatarFileInput.files[0]);
        } else if (emojiInput.value) {
            avatarPreview.innerHTML = `<span style="font-size:48px;">${emojiInput.value}</span>`;
        } else {
            avatarPreview.innerHTML = '';
        }
    }
    avatarFileInput.addEventListener('change', updateAvatarPreview);
    emojiInput.addEventListener('input', updateAvatarPreview);
    updateAvatarPreview();
    // System Prompt
    const sysPromptLabel = document.createElement('label');
    sysPromptLabel.textContent = 'System Prompt:';
    sysPromptLabel.htmlFor = 'character-edit-system-prompt';
    content.appendChild(sysPromptLabel);
    const sysPromptInput = document.createElement('textarea');
    sysPromptInput.id = 'character-edit-system-prompt';
    sysPromptInput.rows = 3;
    sysPromptInput.value = character.systemPrompt || '';
    sysPromptInput.placeholder = 'System prompt for this character...';
    content.appendChild(sysPromptInput);
    // Greeting
    const greetingLabel = document.createElement('label');
    greetingLabel.textContent = 'Greeting:';
    greetingLabel.htmlFor = 'character-edit-greeting';
    content.appendChild(greetingLabel);
    const greetingInput = document.createElement('textarea');
    greetingInput.id = 'character-edit-greeting';
    greetingInput.rows = 2;
    greetingInput.value = character.greeting || '';
    greetingInput.placeholder = 'Greeting message...';
    content.appendChild(greetingInput);
    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = mode === 'add' ? 'Add' : 'Save';
    saveBtn.className = 'character-confirm-btn';
    saveBtn.onclick = () => {
        const handleSave = (avatarData) => {
            const newChar = {
                ...character,
                name: nameInput.value.trim(),
                avatar: avatarData,
                systemPrompt: sysPromptInput.value.trim(),
                greeting: greetingInput.value.trim(),
            };
            if (!newChar.name) {
                nameInput.focus();
                return;
            }
            onSave && onSave(newChar);
            modal.remove();
        };
        // Prefer image file if selected
        const file = avatarFileInput.files && avatarFileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                handleSave(e.target.result); // base64 image
            };
            reader.readAsDataURL(file);
        } else {
            handleSave(emojiInput.value.trim());
        }
    };
    content.appendChild(saveBtn);
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'character-cancel-btn';
    cancelBtn.onclick = () => {
        onCancel && onCancel();
        modal.remove();
    };
    content.appendChild(cancelBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
}
