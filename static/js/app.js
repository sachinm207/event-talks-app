/**
 * BigQuery Release Notes Radar - Frontend Application Logic
 * Modern vanilla JS with async API integration, spinner controls, and X/Twitter composer.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const categoryPillsContainer = document.getElementById('category-pills');
    const releaseNotesList = document.getElementById('release-notes-list');
    const updateCountEl = document.getElementById('update-count');
    const lastSyncTimeEl = document.getElementById('last-sync-time');
    const statusTextEl = document.getElementById('status-text');

    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charProgressBar = document.getElementById('char-progress-bar');
    const charCountText = document.getElementById('char-count-text');
    const copyTweetBtn = document.getElementById('copy-tweet-btn');
    const postXBtn = document.getElementById('post-x-btn');
    const hashtagChips = document.querySelectorAll('.hashtag-chip');

    // State Variables
    let allReleaseItems = [];
    let currentCategory = 'All';
    let currentSearch = '';
    let currentActiveTweetDraft = '';

    // ==========================================
    // 1. Initial Load & Theme Handling
    // ==========================================
    initTheme();
    loadReleaseNotes();

    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        showToast(`Switched to ${newTheme} mode`);
    });

    // ==========================================
    // 2. Fetch & Refresh Release Notes
    // ==========================================
    async function loadReleaseNotes(forceRefresh = false) {
        if (forceRefresh) {
            refreshBtn.classList.add('spinning');
            statusTextEl.textContent = 'Refreshing...';
        }

        try {
            const url = forceRefresh ? '/api/release-notes?refresh=true' : '/api/release-notes';
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                allReleaseItems = data.items;
                lastSyncTimeEl.textContent = `Last sync: ${data.last_updated}`;
                statusTextEl.textContent = 'Live Connected';

                renderCategoryPills(data.categories);
                renderReleaseCards();

                if (forceRefresh) {
                    showToast('✅ BigQuery release notes refreshed live!');
                }
            } else {
                showToast(`❌ Error: ${data.error}`);
                statusTextEl.textContent = 'Sync Error';
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('❌ Failed to connect to server');
            statusTextEl.textContent = 'Disconnected';
        } finally {
            refreshBtn.classList.remove('spinning');
        }
    }

    // Refresh Button Event Listener
    refreshBtn.addEventListener('click', () => {
        loadReleaseNotes(true);
    });

    // ==========================================
    // 3. Category Pills & Search Rendering
    // ==========================================
    function renderCategoryPills(categories) {
        categoryPillsContainer.innerHTML = '<button class="pill active" data-category="All">All Updates</button>';
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `pill ${currentCategory === cat ? 'active' : ''}`;
            btn.dataset.category = cat;
            btn.textContent = cat;
            categoryPillsContainer.appendChild(btn);
        });

        // Add Event delegation for pills
        categoryPillsContainer.querySelectorAll('.pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                categoryPillsContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                currentCategory = e.target.dataset.category;
                renderReleaseCards();
            });
        });
    }

    // Search Input Listener
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim().toLowerCase();
        searchClear.style.display = currentSearch ? 'block' : 'none';
        renderReleaseCards();
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        currentSearch = '';
        searchClear.style.display = 'none';
        renderReleaseCards();
    });

    // ==========================================
    // 4. Render Release Cards
    // ==========================================
    function renderReleaseCards() {
        let filtered = allReleaseItems;

        if (currentCategory !== 'All') {
            filtered = filtered.filter(item => item.category.toLowerCase() === currentCategory.toLowerCase());
        }

        if (currentSearch) {
            filtered = filtered.filter(item => 
                item.title.toLowerCase().includes(currentSearch) ||
                item.plain_text.toLowerCase().includes(currentSearch) ||
                item.date.toLowerCase().includes(currentSearch) ||
                item.category.toLowerCase().includes(currentSearch)
            );
        }

        updateCountEl.textContent = `${filtered.length} Updates`;

        if (filtered.length === 0) {
            releaseNotesList.innerHTML = `
                <div class="note-card" style="text-align: center; padding: 40px;">
                    <h3>No matching BigQuery updates found</h3>
                    <p style="color: var(--text-muted); margin-top: 8px;">Try clearing search filters or refreshing feed.</p>
                </div>
            `;
            return;
        }

        releaseNotesList.innerHTML = filtered.map(item => {
            const badgeClass = getBadgeClass(item.category);
            return `
                <article class="note-card" id="card-${item.id}">
                    <div class="card-header">
                        <span class="badge ${badgeClass}">${escapeHtml(item.category)}</span>
                        <span class="card-date">${escapeHtml(item.date)}</span>
                    </div>

                    <h3 class="card-title">${escapeHtml(item.title)}</h3>
                    
                    <div class="card-body">
                        ${item.html}
                    </div>

                    <div class="card-actions">
                        <button class="action-btn tweet-action-btn" onclick="openTweetModal('${item.id}')">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            Tweet Update
                        </button>

                        <button class="action-btn" onclick="copyCardText('${item.id}')">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                            </svg>
                            Copy Summary
                        </button>

                        <a href="${item.link}" target="_blank" rel="noopener" class="action-btn" style="margin-left: auto;">
                            View Doc ↗
                        </a>
                    </div>
                </article>
            `;
        }).join('');
    }

    function getBadgeClass(category) {
        const cat = category.toLowerCase();
        if (cat.includes('feature')) return 'badge-feature';
        if (cat.includes('changed')) return 'badge-changed';
        if (cat.includes('deprecated')) return 'badge-deprecated';
        if (cat.includes('fix')) return 'badge-fix';
        return 'badge-general';
    }

    // Global helper for opening Tweet modal
    window.openTweetModal = function(itemId) {
        const item = allReleaseItems.find(i => i.id === itemId);
        if (!item) return;

        tweetTextarea.value = item.tweet_draft;
        updateCharCounter();
        tweetModal.classList.add('active');
    };

    // Global helper for copying summary text
    window.copyCardText = function(itemId) {
        const item = allReleaseItems.find(i => i.id === itemId);
        if (!item) return;

        const copyContent = `[BigQuery ${item.category}] ${item.date}\n${item.plain_text}\nLink: ${item.link}`;
        navigator.clipboard.writeText(copyContent).then(() => {
            showToast('📋 Summary copied to clipboard!');
        });
    };

    // ==========================================
    // 5. Tweet Modal & Character Counter Logic
    // ==========================================
    function updateCharCounter() {
        const length = tweetTextarea.value.length;
        charCountText.textContent = `${length} / 280`;

        const percentage = Math.min((length / 280) * 100, 100);
        charProgressBar.style.width = `${percentage}%`;

        if (length > 260) {
            charProgressBar.className = 'progress-bar-fill danger';
        } else if (length > 200) {
            charProgressBar.className = 'progress-bar-fill warning';
        } else {
            charProgressBar.className = 'progress-bar-fill';
        }
    }

    tweetTextarea.addEventListener('input', updateCharCounter);

    modalCloseBtn.addEventListener('click', () => {
        tweetModal.classList.remove('active');
    });

    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            tweetModal.classList.remove('active');
        }
    });

    // Hashtag Chips Toggle
    hashtagChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            if (!tweetTextarea.value.includes(tag)) {
                if (tweetTextarea.value.length + tag.length + 1 <= 280) {
                    tweetTextarea.value += ` ${tag}`;
                    updateCharCounter();
                } else {
                    showToast('⚠️ Reached 280 character limit!');
                }
            }
        });
    });

    // Copy Tweet Text Button
    copyTweetBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(tweetTextarea.value).then(() => {
            showToast('📋 Tweet copy saved to clipboard!');
        });
    });

    // Post to X (Twitter) Web Intent URL
    postXBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank');
        tweetModal.classList.remove('active');
        showToast('🚀 Opening X / Twitter Intent composer!');
    });

    // ==========================================
    // 6. Toast Notification Helper
    // ==========================================
    function showToast(message) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
