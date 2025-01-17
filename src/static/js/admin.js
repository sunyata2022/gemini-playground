// admin.js - Entry point
import { initializeApp } from './admin/core.js';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
    });
});
