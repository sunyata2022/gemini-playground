// admin.js - Entry point
import { initAuth } from './admin/auth.js';
import { initTabs } from './admin/ui/tabs.js';
import { initUserKeysPage } from './admin/pages/user-keys.js';
import { initGeminiKeysPage } from './admin/pages/gemini-keys.js';
import { initRedeemPage } from './admin/pages/redeem.js';

// Initialize the application
async function initializeApp() {
    try {
        // Initialize authentication first
        const authResult = await initAuth();
        
        // Only proceed if authentication is successful
        if (authResult) {
            // Show main content after auth
            document.getElementById('mainContent').style.display = 'block';
            
            // Initialize all pages first (so they can set up their event listeners)
            initUserKeysPage();
            initGeminiKeysPage();
            initRedeemPage();
            
            // Initialize tabs last (which will trigger the initial tab load)
            initTabs();
        }
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
