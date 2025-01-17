import { ApiClient } from './utils/api.js';

// Global state
let api = null;
export const getApi = () => api;

// Initialize the application
export async function initializeApp() {
    // Get stored token
    const token = sessionStorage.getItem('adminToken');
    api = new ApiClient(token);

    // Initialize all modules
    const elements = {
        authDialog: document.getElementById('authDialog'),
        mainContent: document.getElementById('mainContent'),
        adminToken: document.getElementById('adminToken'),
        confirmAuth: document.getElementById('confirmAuth'),
        messageDialog: document.getElementById('messageDialog'),
        messageText: document.getElementById('messageText'),
        confirmMessage: document.getElementById('confirmMessage'),
        createKeyBtn: document.getElementById('createKeyBtn'),
        createKeyDialog: document.getElementById('createKeyDialog'),
        validityDays: document.getElementById('validityDays'),
        keyNote: document.getElementById('keyNote'),
        cancelCreateKey: document.getElementById('cancelCreateKey'),
        confirmCreateKey: document.getElementById('confirmCreateKey'),
        keyCreatedDialog: document.getElementById('keyCreatedDialog'),
        createdKeyDisplay: document.getElementById('createdKeyDisplay'),
        keyValidityDisplay: document.getElementById('keyValidityDisplay'),
        copyKeyBtn: document.getElementById('copyKeyBtn'),
        closeKeyDialog: document.getElementById('closeKeyDialog'),
        keysListContent: document.getElementById('keysListContent'),
        searchInput: document.getElementById('searchInput'),
        filterButtons: document.querySelectorAll('.filter-button'),
        editDialog: document.getElementById('editDialog'),
        editNote: document.getElementById('editNoteInput'),
        editValidityDays: document.getElementById('editExpiryDays'),
        cancelEdit: document.getElementById('cancelEdit'),
        confirmEdit: document.getElementById('confirmEdit')
    };

    // 动态导入所有模块
    const [
        { initAuth },
        { initKeyManager },
        { initDialogs },
        { initTabs },
        { initSearch }
    ] = await Promise.all([
        import('./auth.js'),
        import('./key-manager.js'),
        import('./ui/dialogs.js'),
        import('./ui/tabs.js'),
        import('./ui/search.js')
    ]);

    // Initialize all components
    await Promise.all([
        initAuth(elements),
        initKeyManager(elements),
        initDialogs(elements),
        initTabs(),
        initSearch(elements)
    ]);

    return elements;
}

// Remove the duplicate event listener
// document.addEventListener('DOMContentLoaded', initializeApp);
