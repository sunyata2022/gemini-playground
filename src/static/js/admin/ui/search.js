// 搜索功能模块
let searchTimeout = null;
let currentFilter = 'active';

// 初始化搜索模块
export function initSearch(elements) {
    const { searchInput, filterButtons } = elements;
    const clearSearch = document.getElementById('clearSearch');

    // 搜索输入事件
    searchInput?.addEventListener('input', (e) => {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        const value = e.target.value.trim();
        clearSearch.style.display = value ? 'flex' : 'none';
        
        searchTimeout = setTimeout(() => {
            triggerSearch(value.toLowerCase());
        }, 300);
    });

    // 清除搜索
    clearSearch?.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            clearSearch.style.display = 'none';
            triggerSearch('');
            searchInput.focus();
        }
    });

    // 筛选按钮事件
    filterButtons?.forEach(button => {
        button?.addEventListener('click', (e) => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            triggerSearch(searchInput?.value || '');
        });
    });
}

// 触发搜索事件
function triggerSearch(query) {
    document.dispatchEvent(new CustomEvent('search:changed', {
        detail: {
            query,
            filter: currentFilter
        }
    }));
}

// 筛选和搜索密钥
export function filterAndSearchKeys(keys, searchQuery, filter = currentFilter) {
    console.log('Filtering keys:', { keys, searchQuery, filter });
    return keys.filter(keyData => {
        const { key, info } = keyData;
        const searchQueryLower = searchQuery.toLowerCase();
        
        const matchesSearch = !searchQuery || 
            key.toLowerCase().includes(searchQueryLower) ||
            (info.note && info.note.toLowerCase().includes(searchQueryLower));

        const matchesFilter = filter === 'all' || 
            (filter === 'active' && info.active && info.expiresAt > Date.now()) ||
            (filter === 'inactive' && (!info.active || info.expiresAt <= Date.now()));

        return matchesSearch && matchesFilter;
    });
}
