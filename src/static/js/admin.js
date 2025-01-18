// admin.js - Entry point
import { initAuth } from './admin/auth.js';
import { initTabs } from './admin/ui/tabs.js';
import { initUserKeysPage } from './admin/pages/user-keys.js';
import { initGeminiKeysPage } from './admin/pages/gemini-keys.js';
import { initSettingsPage } from './admin/pages/settings.js';

// Initialize the application
async function initializeApp() {
    try {
        // Initialize authentication
        await initAuth();
        
        // Show main content after auth
        document.getElementById('mainContent').style.display = 'block';
        
        // Initialize tabs
        initTabs();
        
        // Initialize all pages
        initUserKeysPage();
        initGeminiKeysPage();
        initSettingsPage();
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
    });
});
