/* ==========================================================================
   MK TECH - CLIENT CORE JAVASCRIPT
   Description: Local database state management, theme controls, inquiry flows,
                and administrative project management.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    /* --------------------------------------------------------------------------
       1. INITIALIZE PROJECT DATABASE (REST API & DB STATE)
       -------------------------------------------------------------------------- */
    let projects = [];
    let storeProducts = [];
    let profile = {};
    let inquiries = [];
    let passcodeCustomized = false;

    // Escape HTML to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Retrieve JWT session tokens
    function getAuthHeader() {
        const token = sessionStorage.getItem('mktech_admin_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    // Modern fetch wrapper with automatic Auth and error handling
    async function apiFetch(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
            ...(options.headers || {})
        };

        const finalOptions = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, finalOptions);
            
            if (response.status === 401 || response.status === 403) {
                // Administrative session expired or token is invalid
                sessionStorage.removeItem('mktech_admin_authenticated');
                sessionStorage.removeItem('mktech_admin_token');
                
                // Close dashboard
                if (typeof adminDashboardSection !== 'undefined') {
                    adminDashboardSection.classList.add('hidden');
                }
                
                showToast('Admin session expired. Please re-authenticate.', 'error');
                return { success: false, expired: true };
            }

            return await response.json();
        } catch (err) {
            console.error(`API Fetch Error (${url}):`, err);
            showToast('Network error. Check server status.', 'error');
            return { success: false, error: err };
        }
    }

    async function initDatabase() {
        try {
            const response = await fetch('/api/projects');
            projects = await response.json();
            renderGallery();
            renderHomepageProjects();
        } catch (err) {
            console.error('Failed to load project database:', err);
            showToast('Failed to retrieve project database.', 'error');
        }
    }

    async function initStoreProducts() {
        try {
            const response = await fetch('/api/store');
            storeProducts = await response.json();
        } catch (err) {
            console.error('Failed to load store products:', err);
        }
    }

    async function initProfile() {
        try {
            const response = await fetch('/api/profile');
            profile = await response.json();
            applyProfileSettings();
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }

    function applyProfileSettings() {
        const cleanWhatsapp = profile.whatsapp.replace(/\D/g, '');
        
        // 1. WhatsApp floating button link
        const whatsappFloating = document.getElementById('whatsapp-floating');
        if (whatsappFloating) {
            whatsappFloating.href = `https://wa.me/${cleanWhatsapp}?text=Hi%20MK%20Tech%2C%20I%20am%20interested%20in%20your%20Arduino%20and%20electronics%20project%20services.`;
        }

        // 2. WhatsApp links in footer & social areas
        document.querySelectorAll('.dynamic-whatsapp-link').forEach(link => {
            link.href = `https://wa.me/${cleanWhatsapp}`;
        });

        // 3. Instagram links
        document.querySelectorAll('.dynamic-instagram-link').forEach(link => {
            link.href = `https://instagram.com/${profile.instagram}`;
        });

        // 4. YouTube links
        document.querySelectorAll('.dynamic-youtube-link').forEach(link => {
            link.href = profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/c/${profile.youtube}`;
        });

        // 5. Email links
        document.querySelectorAll('.dynamic-email-link').forEach(link => {
            link.href = `mailto:${profile.email}`;
        });

        // 6. Text Elements
        document.querySelectorAll('.dynamic-whatsapp-text').forEach(el => {
            el.textContent = profile.whatsapp;
        });

        document.querySelectorAll('.dynamic-email-text').forEach(el => {
            el.textContent = profile.email;
        });

        document.querySelectorAll('.dynamic-address-text').forEach(el => {
            el.textContent = profile.address;
        });

        // 7. Dynamic Pricing values
        const basicSpan = document.getElementById('price-val-basic');
        const intermediateSpan = document.getElementById('price-val-intermediate');
        const advancedSpan = document.getElementById('price-val-advanced');

        if (basicSpan) basicSpan.textContent = profile.priceBasic || '2,999';
        if (intermediateSpan) intermediateSpan.textContent = profile.priceIntermediate || '6,999';
        if (advancedSpan) advancedSpan.textContent = profile.priceAdvanced || '14,999';

        // Helper to dynamically render tier list elements
        function renderPriceList(listId, listText) {
            const listEl = document.getElementById(listId);
            if (!listEl) return;
            listEl.innerHTML = '';
            
            const items = listText.split('\n')
                                  .map(item => item.trim())
                                  .filter(item => item.length > 0);
                                  
            items.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fa-solid fa-check feature-check"></i> ${item}`;
                listEl.appendChild(li);
            });
        }

        renderPriceList('features-list-basic', profile.featuresBasic || '');
        renderPriceList('features-list-intermediate', profile.featuresIntermediate || '');
        renderPriceList('features-list-advanced', profile.featuresAdvanced || '');
        renderPriceList('features-list-custom', profile.featuresCustom || '');

        // Web Development pricing
        const webSpan = document.getElementById('price-val-web');
        if (webSpan) webSpan.textContent = profile.priceWeb || '4,999';
        renderPriceList('features-list-web', profile.featuresWeb || '');
    }

    async function initSecurity() {
        try {
            const response = await fetch('/api/auth/status');
            const data = await response.json();
            passcodeCustomized = data.passcodeCustomized;
            updateAuthHint();
        } catch (err) {
            console.error('Failed to load security state:', err);
        }
    }

    function updateAuthHint() {
        const authHintEl = document.getElementById('auth-hint-text');
        if (authHintEl) {
            authHintEl.textContent = 'Enter your admin passcode to access the dashboard.';
        }
    }

    async function initInquiries() {
        const sessionAuth = sessionStorage.getItem('mktech_admin_authenticated');
        if (sessionAuth !== 'true') return;

        const data = await apiFetch('/api/inquiries');
        if (data && !data.expired) {
            inquiries = data;
            renderInbox();
        }
    }

    function renderInbox() {
        const inboxList = document.getElementById('admin-inbox-list');
        const inboxBadge = document.getElementById('inbox-badge');
        
        if (!inboxList) return;
        inboxList.innerHTML = '';
        
        if (inboxBadge) inboxBadge.textContent = inquiries.length;
        
        if (inquiries.length === 0) {
            inboxList.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 40px 0; grid-column: 1 / -1; width: 100%;">
                    <i class="fa-solid fa-envelope-open" style="font-size: 2.5rem; color: var(--border-color); margin-bottom: 12px; display: block;"></i>
                    <p>Your Inbox is empty! All customer form submissions will show up here.</p>
                </div>
            `;
            return;
        }
        
        inquiries.forEach(inq => {
            const card = document.createElement('div');
            card.className = 'admin-item-card';
            card.style.flexDirection = 'column';
            card.style.alignItems = 'stretch';
            card.style.gap = '12px';
            card.style.padding = '16px';
            card.style.width = '100%';
            
            const safeName = escapeHtml(inq.name);
            const safeDate = escapeHtml(inq.date);
            const safePhone = escapeHtml(inq.phone);
            const safeEmail = escapeHtml(inq.email);
            const safeCategory = escapeHtml(inq.category);
            const safeProject = escapeHtml(inq.project || '');
            const safeMessage = escapeHtml(inq.message);
            const waPhone = inq.phone.replace(/\D/g, '');

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dashed var(--border-color); padding-bottom: 8px;">
                    <div>
                        <strong style="color: var(--accent-cyan); font-size: 0.95rem;">${safeName}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 8px;">(${safeDate})</span>
                    </div>
                    <button type="button" class="action-icon-btn delete-inq-btn" data-id="${inq.id}" title="Delete Inquiry" style="width: 28px; height: 28px;">
                        <i class="fa-solid fa-trash-can" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
                <div style="font-size: 0.85rem; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; color: var(--text-secondary);">
                    <div><i class="fa-solid fa-phone"></i> ${safePhone}</div>
                    <div><i class="fa-solid fa-envelope"></i> ${safeEmail}</div>
                    <div><i class="fa-solid fa-layer-group"></i> ${safeCategory}</div>
                    ${inq.project ? `<div><i class="fa-solid fa-microchip"></i> <strong>${safeProject}</strong></div>` : ''}
                </div>
                <div style="font-size: 0.9rem; color: var(--text-primary); background-color: var(--bg-primary); padding: 10px; border-radius: 4px; border-left: 3px solid var(--accent-blue); white-space: pre-wrap; word-break: break-word;">${safeMessage}</div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
                    <a href="mailto:${safeEmail}?subject=Inquiry Reply - MK Tech" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.75rem; height: 28px;">
                        <i class="fa-regular fa-envelope"></i> Email Reply
                    </a>
                    <a href="https://wa.me/${waPhone}?text=Hi%20${encodeURIComponent(inq.name)}%2C%20this%20is%20MK%20Tech%20replying%20to%20your%20inquiry." target="_blank" class="btn btn-success" style="padding: 6px 12px; font-size: 0.75rem; height: 28px; background: #128c7e; box-shadow: none;">
                        <i class="fa-brands fa-whatsapp"></i> WhatsApp Reply
                    </a>
                </div>
            `;
            
            inboxList.appendChild(card);
        });
        
        // Bind single delete triggers
        inboxList.querySelectorAll('.delete-inq-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const qid = btn.dataset.id;
                deleteInquiry(qid);
            });
        });
    }

    async function deleteInquiry(id) {
        const data = await apiFetch(`/api/inquiries/${id}`, { method: 'DELETE' });
        if (data && data.success) {
            inquiries = inquiries.filter(inq => inq.id !== id);
            renderInbox();
            showToast('Inquiry deleted successfully.', 'success');
        }
    }

    initDatabase();
    initStoreProducts();
    initProfile();
    initInquiries();
    initSecurity();

    /* --------------------------------------------------------------------------
       2. DOM SELECTIONS
       -------------------------------------------------------------------------- */
    // General
    const body = document.body;
    const navbar = document.getElementById('navbar');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const hamburgerMenuBtn = document.getElementById('hamburger-menu');
    const navLinksList = document.getElementById('nav-links');
    
    // Gallery & Filter
    const projectsGrid = document.getElementById('projects-grid');
    const searchInput = document.getElementById('project-search');
    const filterPillsContainer = document.getElementById('filter-pills');
    
    // Modals
    const inquiryModal = document.getElementById('inquiry-modal');
    const adminAuthSection = document.getElementById('admin-auth-section');
    const adminDashboardSection = document.getElementById('admin-dashboard-section');
    
    // Forms & Inputs
    const mainContactForm = document.getElementById('main-contact-form');
    const projectInquiryForm = document.getElementById('project-inquiry-form');
    const adminAuthForm = document.getElementById('admin-auth-form');
    const adminProjectForm = document.getElementById('admin-project-form');
    const adminProfileForm = document.getElementById('admin-profile-form');
    const adminSecurityForm = document.getElementById('admin-security-form');
    
    // Triggers / Buttons
    const logoAreas = document.querySelectorAll('.logo-area');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const adminTabButtons = document.querySelectorAll('.admin-tab-btn');
    const adminTabContents = document.querySelectorAll('.admin-tab-content');
    const inquiryCloseBtn = document.getElementById('inquiry-close-btn');
    const adminCancelEditBtn = document.getElementById('admin-cancel-edit-btn');
    
    // Admin Specific Form controls
    const adminImageFileInput = document.getElementById('admin-proj-image-file');
    const adminImageDropzone = document.getElementById('image-upload-dropzone');
    const adminImagePreviewContainer = document.getElementById('image-upload-preview-container');
    const adminImagePreview = document.getElementById('image-preview');
    const adminImageRemoveBtn = document.getElementById('remove-preview-btn');
    const adminImageUrlInput = document.getElementById('admin-proj-image-url');
    const adminProjectsList = document.getElementById('admin-projects-list');
    const adminProjectCountSpan = document.getElementById('admin-project-count');
    
    // Admin Store Specific Form controls
    const adminStoreForm = document.getElementById('admin-store-form');
    const adminStoreProductId = document.getElementById('admin-store-product-id');
    const adminStoreTitle = document.getElementById('admin-store-title');
    const adminStoreCategory = document.getElementById('admin-store-category');
    const adminStoreTags = document.getElementById('admin-store-tags');
    const adminStorePrice = document.getElementById('admin-store-price');
    const adminStoreOrigPrice = document.getElementById('admin-store-orig-price');
    const adminStoreStock = document.getElementById('admin-store-stock');
    const adminStoreDesc = document.getElementById('admin-store-desc');
    const adminStoreIncluded = document.getElementById('admin-store-included');
    const adminStoreImageFile = document.getElementById('admin-store-image-file');
    const adminStoreImageDropzone = document.getElementById('store-image-upload-dropzone');
    const adminStoreImagePreviewContainer = document.getElementById('store-image-upload-preview-container');
    const adminStoreImagePreview = document.getElementById('store-image-preview');
    const adminStoreImageRemoveBtn = document.getElementById('store-remove-preview-btn');
    const adminStoreImageUrl = document.getElementById('admin-store-image-url');
    const adminStoreList = document.getElementById('admin-store-list');
    const adminStoreCountSpan = document.getElementById('admin-store-count');
    const adminStoreCancelEditBtn = document.getElementById('admin-store-cancel-edit-btn');
    
    // Inquiry Modal Prefills
    const inquiryProjectName = document.getElementById('inquiry-project-name');
    const inquiryProjectId = document.getElementById('inquiry-project-id');
    const channelWhatsappBtn = document.getElementById('channel-whatsapp');
    const channelEmailBtn = document.getElementById('channel-email');
    
    // Toast
    const toastContainer = document.getElementById('toast-container');

    // Active Gallery Filter State
    let currentCategory = 'all';
    let currentSearchQuery = '';
    let currentInquiryChannel = 'whatsapp'; // Default channel

    /* --------------------------------------------------------------------------
       3. SYSTEM TOAST ALERTS
       -------------------------------------------------------------------------- */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'info') icon = 'fa-circle-info';
        
        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Trigger transition
        setTimeout(() => toast.classList.add('show'), 50);
        
        // Remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    /* --------------------------------------------------------------------------
       4. THEME CONTROLLER & SYNC
       -------------------------------------------------------------------------- */
    function initTheme() {
        const cachedTheme = localStorage.getItem('mktech_theme') || 'dark';
        if (cachedTheme === 'light') {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            if (body.classList.contains('dark-theme')) {
                body.classList.remove('dark-theme');
                body.classList.add('light-theme');
                themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
                localStorage.setItem('mktech_theme', 'light');
                showToast('Light theme activated!', 'info');
            } else {
                body.classList.remove('light-theme');
                body.classList.add('dark-theme');
                themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
                localStorage.setItem('mktech_theme', 'dark');
                showToast('Dark theme activated!', 'info');
            }
        });
    }

    initTheme();

    /* --------------------------------------------------------------------------
       5. RESPONSIVE NAVBAR & ACTIVE LINKS SCROLL
       -------------------------------------------------------------------------- */
    // Scroll event: dynamic glass styling
    window.addEventListener('scroll', () => {
        if (navbar) {
            if (window.scrollY > 40) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    // Mobile Hamburger toggle
    if (hamburgerMenuBtn && navLinksList) {
        hamburgerMenuBtn.addEventListener('click', () => {
            hamburgerMenuBtn.classList.toggle('active');
            navLinksList.classList.toggle('active');
        });

        // Close mobile nav when link is clicked
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                hamburgerMenuBtn.classList.remove('active');
                navLinksList.classList.remove('active');
            });
        });
    }

    // Highlight navigation items as user scrolls (Intersection Observer)
    const sections = document.querySelectorAll('section');
    const navItems = document.querySelectorAll('.nav-item');

    if (sections.length > 0 && navItems.length > 0) {
        const observerOptions = {
            root: null,
            rootMargin: '-30% 0px -60% 0px', // Trigger near screen middle
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    navItems.forEach(item => {
                        item.classList.remove('active');
                        if (item.getAttribute('href') === `#${id}` || item.getAttribute('href') === `index.html#${id}`) {
                            item.classList.add('active');
                        }
                    });
                }
            });
        }, observerOptions);

        sections.forEach(section => observer.observe(section));
    }

    /* --------------------------------------------------------------------------
       6. RENDER LOGIC: PROJECT GALLERY
       -------------------------------------------------------------------------- */
    function renderGallery() {
        if (!projectsGrid) return;
        projectsGrid.innerHTML = '';
        
        const filtered = projects.filter(proj => {
            const matchesCategory = (currentCategory === 'all') || (proj.category.toLowerCase() === currentCategory.toLowerCase());
            
            const searchLower = currentSearchQuery.toLowerCase();
            const matchesSearch = proj.title.toLowerCase().includes(searchLower) || 
                                  proj.description.toLowerCase().includes(searchLower) ||
                                  proj.tags.some(tag => tag.toLowerCase().includes(searchLower));
            
            return matchesCategory && matchesSearch;
        });

        if (filtered.length === 0) {
            projectsGrid.innerHTML = `
                <div class="loader-placeholder">
                    <i class="fa-solid fa-ban"></i>
                    <p>No projects match your search criteria. Try a different category or search term!</p>
                </div>
            `;
            return;
        }

        filtered.forEach(proj => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.dataset.id = proj.id;
            
            // Build tags list
            const tagsHTML = proj.tags.map(tag => `<span class="project-tag">${tag}</span>`).join('');
            
            card.innerHTML = `
                <div class="project-image-wrapper">
                    <img src="${proj.image}" alt="${proj.title}" loading="lazy">
                    <span class="project-category-badge">${proj.category}</span>
                </div>
                <div class="project-info">
                    <div class="project-tags">${tagsHTML}</div>
                    <h3>${proj.title}</h3>
                    <p>${proj.description}</p>
                    <div class="project-card-footer">
                        <button class="btn btn-outline-primary inquiry-btn" data-id="${proj.id}">
                            Inquire Now <i class="fa-solid fa-comment-dots"></i>
                        </button>
                    </div>
                </div>
            `;
            
            projectsGrid.appendChild(card);
        });

        // Add event listeners for dynamic inquiry triggers
        document.querySelectorAll('.inquiry-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pid = btn.dataset.id;
                openInquiryModal(pid);
            });
        });
    }

    // Homepage Featured Projects (only showOnHomepage === true)
    function renderHomepageProjects() {
        const grid = document.getElementById('homepage-projects-grid');
        if (!grid) return;

        const featured = projects.filter(p => p.showOnHomepage !== false);

        if (featured.length === 0) {
            grid.innerHTML = `<div class="loader-placeholder"><p>No featured projects available.</p></div>`;
            return;
        }

        grid.innerHTML = '';
        featured.forEach(proj => {
            const card = document.createElement('div');
            card.className = 'project-card';
            const tagsHTML = proj.tags.map(tag => `<span class="project-tag">${tag}</span>`).join('');
            card.innerHTML = `
                <div class="project-image-wrapper">
                    <img src="${proj.image}" alt="${proj.title}" loading="lazy">
                    <span class="project-category-badge">${proj.category}</span>
                </div>
                <div class="project-info">
                    <div class="project-tags">${tagsHTML}</div>
                    <h3>${proj.title}</h3>
                    <p>${proj.description}</p>
                    <div class="project-card-footer">
                        <a href="projects.html" class="btn btn-outline-primary">
                            View Details <i class="fa-solid fa-arrow-right-long"></i>
                        </a>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // Filter Pills Listener
    if (filterPillsContainer) {
        filterPillsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill')) {
                document.querySelectorAll('.pill').forEach(pill => pill.classList.remove('active'));
                e.target.classList.add('active');
                
                currentCategory = e.target.dataset.category;
                renderGallery();
            }
        });
    }

    // Real-time Search Listener
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderGallery();
        });
    }

    // Initial render
    renderGallery();



    /* --------------------------------------------------------------------------
       8. MODAL CONTROL LOGIC
       -------------------------------------------------------------------------- */
    function openModal(modal) {
        modal.classList.add('active');
        body.style.overflow = 'hidden'; // Lock background scroll
    }

    function closeModal(modal) {
        modal.classList.remove('active');
        body.style.overflow = ''; // Unlock scroll
    }

    function showAdminAuth() {
        if (adminAuthSection) adminAuthSection.classList.remove('hidden');
        if (adminDashboardSection) adminDashboardSection.classList.add('hidden');
    }

    function showAdminDashboard() {
        if (adminAuthSection) adminAuthSection.classList.add('hidden');
        if (adminDashboardSection) adminDashboardSection.classList.remove('hidden');
    }

    // Closing listeners
    if (inquiryCloseBtn && inquiryModal) {
        inquiryCloseBtn.addEventListener('click', () => closeModal(inquiryModal));
    }

    /* --------------------------------------------------------------------------
       9. PROJECT INQUIRY SYSTEM
       -------------------------------------------------------------------------- */
    function openInquiryModal(projectId) {
        if (!inquiryProjectId || !inquiryProjectName || !inquiryModal) return;
        const proj = projects.find(p => p.id === projectId);
        if (!proj) return;
        
        inquiryProjectId.value = proj.id;
        inquiryProjectName.textContent = proj.title;
        
        // Reset inquiry form details
        if (projectInquiryForm) projectInquiryForm.reset();
        
        // Default to WhatsApp
        setInquiryChannel('whatsapp');
        
        openModal(inquiryModal);
    }

    function setInquiryChannel(channel) {
        currentInquiryChannel = channel;
        
        if (channelWhatsappBtn) channelWhatsappBtn.classList.remove('active');
        if (channelEmailBtn) channelEmailBtn.classList.remove('active');
        
        if (channel === 'whatsapp') {
            if (channelWhatsappBtn) channelWhatsappBtn.classList.add('active');
        } else {
            if (channelEmailBtn) channelEmailBtn.classList.add('active');
        }
    }

    if (channelWhatsappBtn) channelWhatsappBtn.addEventListener('click', () => setInquiryChannel('whatsapp'));
    if (channelEmailBtn) channelEmailBtn.addEventListener('click', () => setInquiryChannel('email'));

    // Inquiry form submit handler
    let isSubmittingInquiry = false;
    if (projectInquiryForm) {
        projectInquiryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (isSubmittingInquiry) return;
            isSubmittingInquiry = true;
            
            const name = document.getElementById('inquiry-name').value.trim();
            const phone = document.getElementById('inquiry-phone').value.trim();
            const email = document.getElementById('inquiry-email').value.trim();
            const details = document.getElementById('inquiry-details').value.trim();
            const projName = inquiryProjectName.textContent;

            if (!phone && !email) {
                isSubmittingInquiry = false;
                showToast('Please provide at least a Phone Number or an Email Address.', 'error');
                return;
            }

            const submitBtn = projectInquiryForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            if (currentInquiryChannel === 'whatsapp') {
                // Build direct WhatsApp link
                const cleanWhatsapp = (profile.whatsapp || '+91 98765 43210').replace(/\D/g, '');
                const whatsappText = `Hi MK Tech!\n\nI want to inquire about the project: *${projName}*.\n\n*My Details:*\n- Name: ${name}\n- Phone: ${phone}\n- Email: ${email}\n\n*Customization Requirements:*\n${details || 'None specified'}`;
                const encodedText = encodeURIComponent(whatsappText);
                const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedText}`;
                
                closeModal(inquiryModal);
                showToast('Routing to WhatsApp...', 'success');
                if (submitBtn) submitBtn.disabled = false;
                isSubmittingInquiry = false;
                
                // Redirect in a new tab
                window.open(whatsappUrl, '_blank');
            } else {
                // Send inquiry to backend server
                const payload = {
                    name,
                    phone,
                    email,
                    category: 'Inquiry Card',
                    project: projName,
                    message: details || 'No additional customization requirements specified.'
                };
                
                fetch('/api/inquiries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                    if (submitBtn) submitBtn.disabled = false;
                    isSubmittingInquiry = false;
                    if (data && data.success) {
                        inquiries.unshift(data.inquiry);
                        renderInbox();
                        closeModal(inquiryModal);
                        showToast('Inquiry submitted successfully! Saved in your Dashboard Inbox.', 'success');
                    } else {
                        showToast('Failed to submit inquiry. Try again.', 'error');
                    }
                })
                .catch(err => {
                    console.error(err);
                    if (submitBtn) submitBtn.disabled = false;
                    isSubmittingInquiry = false;
                    showToast('Failed to submit inquiry. Network error.', 'error');
                });
            }
        });
    }

    // Trigger Inquiry prefill from Pricing Matrix
    document.querySelectorAll('.pricing-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tier = btn.dataset.tier;
            window.location.href = `contact.html?tier=${encodeURIComponent(tier)}`;
        });
    });

    /* --------------------------------------------------------------------------
       10. ADMIN DASHBOARD AUTHENTICATION
       -------------------------------------------------------------------------- */
    function checkAdminAccess() {
        window.location.href = 'admin.html';
    }

    function checkAdminAccessOnAdminPage() {
        const sessionAuth = sessionStorage.getItem('mktech_admin_authenticated');
        if (sessionAuth === 'true') {
            openAdminDashboard();
        } else {
            showAdminAuth();
            const passcodeEl = document.getElementById('admin-passcode');
            if (passcodeEl) passcodeEl.focus();
        }
    }

    // Secret Triggers: Double click on any MK Tech logo brand area
    logoAreas.forEach(logo => {
        logo.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (window.location.pathname.includes('admin.html') || window.location.pathname.endsWith('/admin')) {
                checkAdminAccessOnAdminPage();
            } else {
                checkAdminAccess();
            }
        });
        logo.setAttribute('title', 'Double-click logo to manage projects');
    });

    // Secret Trigger: Keyboard shortcut (Ctrl + Alt + A)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            if (window.location.pathname.includes('admin.html') || window.location.pathname.endsWith('/admin')) {
                checkAdminAccessOnAdminPage();
            } else {
                checkAdminAccess();
            }
        }
    });

    // Auto check admin access on admin page load
    if (window.location.pathname.includes('admin.html') || window.location.pathname.endsWith('/admin')) {
        setTimeout(checkAdminAccessOnAdminPage, 100);
    }

    if (adminAuthForm) {
        adminAuthForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const passcodeEl = document.getElementById('admin-passcode');
            const codeInput = passcodeEl ? passcodeEl.value : '';
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ passcode: codeInput })
                });
                const data = await response.json();
                
                if (response.ok && data && data.success) {
                    sessionStorage.setItem('mktech_admin_token', data.token);
                    sessionStorage.setItem('mktech_admin_authenticated', 'true');
                    adminAuthForm.reset();
                    const errEl = document.getElementById('auth-error-msg');
                    if (errEl) errEl.style.display = 'none';
                    showToast('Access Granted. Opening Lab Manager Dashboard.', 'success');
                    
                    // Initialize inquiries list (loads records since authenticated!)
                    initInquiries();
                    openAdminDashboard();
                } else {
                    const errEl = document.getElementById('auth-error-msg');
                    if (errEl) errEl.style.display = 'block';
                    showToast(data.message || 'Incorrect passcode. Access Denied.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Authentication failed. Server error.', 'error');
            }
        });
    }

    /* --------------------------------------------------------------------------
       11. ADMIN CRUD INTERFACES & IMAGE UPLOADS
       -------------------------------------------------------------------------- */
    let uploadedImageBase64 = '';
    let isEditingProject = false;
    let editProjectId = '';

    function openAdminDashboard() {
        isEditingProject = false;
        editProjectId = '';
        
        // Reset form & Preview
        adminProjectForm.reset();
        resetImageUploadState();
        
        adminCancelEditBtn.style.display = 'none';
        document.getElementById('admin-form-mode-title').textContent = 'Create New Project';
        document.getElementById('admin-save-btn').querySelector('span').textContent = 'Add Project Card';
        
        // Seed the profile contact form
        const waInput = document.getElementById('admin-prof-whatsapp');
        const instaInput = document.getElementById('admin-prof-instagram');
        const emailInput = document.getElementById('admin-prof-email');
        const ytInput = document.getElementById('admin-prof-youtube');
        const addrInput = document.getElementById('admin-prof-address');

        if (waInput) waInput.value = profile.whatsapp;
        if (instaInput) instaInput.value = profile.instagram;
        if (emailInput) emailInput.value = profile.email;
        if (ytInput) ytInput.value = profile.youtube;
        if (addrInput) addrInput.value = profile.address;

        // Seed pricing settings inputs
        const basicPriceInput = document.getElementById('admin-price-basic');
        const intermediatePriceInput = document.getElementById('admin-price-intermediate');
        const advancedPriceInput = document.getElementById('admin-price-advanced');

        if (basicPriceInput) basicPriceInput.value = profile.priceBasic || '2,999';
        if (intermediatePriceInput) intermediatePriceInput.value = profile.priceIntermediate || '6,999';
        if (advancedPriceInput) advancedPriceInput.value = profile.priceAdvanced || '14,999';

        // Seed web development price
        const webPriceInput = document.getElementById('admin-price-web');
        if (webPriceInput) webPriceInput.value = profile.priceWeb || '4,999';

        // Seed pricing features textareas
        const basicFeatsInput = document.getElementById('admin-features-basic');
        const intermediateFeatsInput = document.getElementById('admin-features-intermediate');
        const advancedFeatsInput = document.getElementById('admin-features-advanced');
        const customFeatsInput = document.getElementById('admin-features-custom');

        if (basicFeatsInput) basicFeatsInput.value = profile.featuresBasic || '';
        if (intermediateFeatsInput) intermediateFeatsInput.value = profile.featuresIntermediate || '';
        if (advancedFeatsInput) advancedFeatsInput.value = profile.featuresAdvanced || '';
        if (customFeatsInput) customFeatsInput.value = profile.featuresCustom || '';

        // Seed web development features
        const webFeatsInput = document.getElementById('admin-features-web');
        if (webFeatsInput) webFeatsInput.value = profile.featuresWeb || '';

        // Reset Tab active states
        adminTabButtons.forEach(btn => btn.classList.remove('active'));
        if (adminTabButtons[0]) adminTabButtons[0].classList.add('active');
        adminTabContents.forEach(content => content.style.display = 'none');
        const tabProjects = document.getElementById('tab-projects');
        if (tabProjects) tabProjects.style.display = 'block';

        // Toggle inventory list default state
        const projectsTitle = document.getElementById('admin-projects-title-container');
        const storeTitle = document.getElementById('admin-store-title-container');
        const projectsList = document.getElementById('admin-projects-list');
        const storeList = document.getElementById('admin-store-list');
        if (projectsTitle) projectsTitle.style.display = 'block';
        if (storeTitle) storeTitle.style.display = 'none';
        if (projectsList) projectsList.style.display = 'block';
        if (storeList) storeList.style.display = 'none';

        // Reset store edit state
        if (typeof cancelStoreEditMode === 'function') {
            cancelStoreEditMode();
        }

        renderAdminProjectsList();
        if (typeof renderAdminStoreList === 'function') {
            renderAdminStoreList();
        }
        showAdminDashboard();
    }

    // Reset dropzone & previews
    function resetImageUploadState() {
        uploadedImageBase64 = '';
        adminImageFileInput.value = '';
        adminImagePreview.src = '';
        adminImagePreviewContainer.style.display = 'none';
        adminImageDropzone.style.display = 'block';
        adminImageUrlInput.value = '';
    }

    // File dropzone trigger click
    if (adminImageDropzone && adminImageFileInput) {
        adminImageDropzone.addEventListener('click', () => adminImageFileInput.click());
    }

    // File Drag/Drop Styling
    if (adminImageDropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            adminImageDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                adminImageDropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            adminImageDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                adminImageDropzone.classList.remove('dragover');
            }, false);
        });

        // Dropzone Drop event
        adminImageDropzone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            processImageFile(file);
        });
    }

    // File input change handler (Base64 file reader)
    if (adminImageFileInput) {
        adminImageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            processImageFile(file);
        });
    }

    function processImageFile(file) {
        if (!file) return;
        
        if (!file.type.match('image.*')) {
            showToast('Please select a valid image file (PNG/JPG).', 'error');
            return;
        }

        if (file.size > 1024 * 1024) { // 1MB limit for localStorage base64
            showToast('Image is too large. Keep file size under 1MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedImageBase64 = event.target.result;
            
            // Set previews
            adminImagePreview.src = uploadedImageBase64;
            adminImageDropzone.style.display = 'none';
            adminImagePreviewContainer.style.display = 'block';
            
            // Clear text URL input to avoid conflict
            adminImageUrlInput.value = '';
        };
        reader.readAsDataURL(file);
    }

    // Remove uploaded image preview click
    if (adminImageRemoveBtn) {
        adminImageRemoveBtn.addEventListener('click', () => {
            resetImageUploadState();
        });
    }

    // Render Admin panel list
    function renderAdminProjectsList() {
        adminProjectsList.innerHTML = '';
        adminProjectCountSpan.textContent = projects.length;

        if (projects.length === 0) {
            adminProjectsList.innerHTML = `<p class="text-center" style="color: var(--text-secondary); padding: 20px 0;">No active projects in database.</p>`;
            return;
        }

        projects.forEach(proj => {
            const item = document.createElement('div');
            item.className = 'admin-item-card';
            
            const safeTitle = escapeHtml(proj.title);
            item.innerHTML = `
                <div class="admin-item-thumb">
                    <img src="${proj.image}" alt="${safeTitle}">
                </div>
                <div class="admin-item-details">
                    <h5>${safeTitle}</h5>
                    <span>${escapeHtml(proj.category)}</span>
                </div>
                <div class="admin-item-actions">
                    <div class="admin-item-toggle" title="Show on Homepage">
                        <label class="toggle-label">
                            <input type="checkbox" class="homepage-toggle" data-id="${proj.id}" ${proj.showOnHomepage !== false ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <button type="button" class="action-icon-btn edit-btn" data-id="${proj.id}" title="Edit Project">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="action-icon-btn delete-btn" data-id="${proj.id}" title="Delete Project">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            
            adminProjectsList.appendChild(item);
        });

        // Delete button triggers
        adminProjectsList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pid = btn.dataset.id;
                deleteProject(pid);
            });
        });

        // Edit button triggers
        adminProjectsList.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pid = btn.dataset.id;
                startEditProject(pid);
            });
        });

        // Homepage toggle triggers
        adminProjectsList.querySelectorAll('.homepage-toggle').forEach(cb => {
            cb.addEventListener('change', function() {
                const pid = this.dataset.id;
                toggleProjectHomepage(pid, this.checked);
            });
        });
    }

    async function toggleProjectHomepage(id, show) {
        const projIndex = projects.findIndex(p => p.id === id);
        if (projIndex === -1) return;

        const data = await apiFetch(`/api/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ showOnHomepage: show })
        });

        if (data && data.success) {
            projects[projIndex].showOnHomepage = show;
            renderAdminProjectsList();
            renderHomepageProjects();
            showToast(`Project visibility ${show ? 'enabled' : 'disabled'} on homepage.`, 'success');
        } else {
            // Revert checkbox on failure
            renderAdminProjectsList();
        }
    }

    // Action CRUD: Delete
    async function deleteProject(id) {
        const projIndex = projects.findIndex(p => p.id === id);
        if (projIndex === -1) return;
        
        const title = projects[projIndex].title;
        
        if (confirm(`Are you sure you want to delete "${title}"?`)) {
            const data = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
            if (data && data.success) {
                projects.splice(projIndex, 1);
                
                // Re-render
                renderAdminProjectsList();
                renderGallery();
                renderHomepageProjects();
                showToast(`Deleted "${title}" successfully.`, 'success');
                
                // If deleting the active editing card, reset editing state
                if (isEditingProject && editProjectId === id) {
                    cancelEditMode();
                }
            }
        }
    }

    // Action CRUD: Start Edit
    function startEditProject(id) {
        const proj = projects.find(p => p.id === id);
        if (!proj) return;

        isEditingProject = true;
        editProjectId = id;

        // Prefill text values
        document.getElementById('admin-proj-title').value = proj.title;
        document.getElementById('admin-proj-category').value = proj.category;
        document.getElementById('admin-proj-tags').value = proj.tags.join(', ');
        document.getElementById('admin-proj-desc').value = proj.description;
        document.getElementById('admin-proj-show-homepage').checked = proj.showOnHomepage !== false;
        
        // Reset Visual uploader
        resetImageUploadState();

        if (proj.image.startsWith('data:image')) {
            // Uploaded Base64 Preview
            uploadedImageBase64 = proj.image;
            adminImagePreview.src = proj.image;
            adminImageDropzone.style.display = 'none';
            adminImagePreviewContainer.style.display = 'block';
        } else {
            // Unsplash / Absolute Image URL fallback
            adminImageUrlInput.value = proj.image;
        }

        // Toggle button layouts
        adminCancelEditBtn.style.display = 'inline-flex';
        document.getElementById('admin-form-mode-title').textContent = `Edit Project ID: ${proj.id}`;
        document.getElementById('admin-save-btn').querySelector('span').textContent = 'Save Changes';
        
        // Scroll to form panel if in mobile view
        document.querySelector('.admin-form-panel').scrollIntoView({ behavior: 'smooth' });
    }

    function cancelEditMode() {
        isEditingProject = false;
        editProjectId = '';
        adminProjectForm.reset();
        resetImageUploadState();
        
        adminCancelEditBtn.style.display = 'none';
        document.getElementById('admin-form-mode-title').textContent = 'Create New Project';
        document.getElementById('admin-save-btn').querySelector('span').textContent = 'Add Project Card';
    }

    adminCancelEditBtn.addEventListener('click', cancelEditMode);

    // Save Admin project form Submit
    if (adminProjectForm) {
        adminProjectForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('admin-proj-title').value.trim();
            const category = document.getElementById('admin-proj-category').value;
            const rawTags = document.getElementById('admin-proj-tags').value;
            const description = document.getElementById('admin-proj-desc').value.trim();
            const urlInput = adminImageUrlInput.value.trim();

            // Process Tags list
            const tags = rawTags.split(',')
                                .map(tag => tag.trim())
                                .filter(tag => tag.length > 0);

            // Get Visual Image value: Preference is base64 file upload, then absolute link, then generic electronics fallback
            let image = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80'; // fallback generic circuit
            
            if (uploadedImageBase64) {
                image = uploadedImageBase64;
            } else if (urlInput) {
                image = urlInput;
            }

                const showOnHomepage = document.getElementById('admin-proj-show-homepage').checked;

            const payload = {
                title,
                category,
                tags,
                description,
                image,
                showOnHomepage
            };

            if (isEditingProject) {
                // UPDATE EXISITING
                const data = await apiFetch(`/api/projects/${editProjectId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                
                if (data && data.success) {
                    const projIndex = projects.findIndex(p => p.id === editProjectId);
                    if (projIndex !== -1) {
                        projects[projIndex] = data.project;
                    }
                    showToast(`Project "${title}" updated successfully!`, 'success');
                    renderGallery();
                    renderAdminProjectsList();
                    renderHomepageProjects();
                    cancelEditMode();
                }
            } else {
                // CREATE NEW
                const data = await apiFetch('/api/projects', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (data && data.success) {
                    projects.unshift(data.project); // Place newest first
                    showToast(`New Project "${title}" added!`, 'success');
                    renderGallery();
                    renderAdminProjectsList();
                    renderHomepageProjects();
                    cancelEditMode();
                }
            }
        });
    }

    /* --------------------------------------------------------------------------
       11b. ADMIN EXTRA UTILITIES (TABS, PROFILE UPDATE, LOGOUT)
       -------------------------------------------------------------------------- */
    // Admin Sub Tabs Trigger click
    adminTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            adminTabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetTab = btn.dataset.tab;
            adminTabContents.forEach(content => content.style.display = 'none');
            
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) targetContent.style.display = 'block';

            // Toggle right panel lists based on active tab
            const projectsTitle = document.getElementById('admin-projects-title-container');
            const storeTitle = document.getElementById('admin-store-title-container');
            const projectsList = document.getElementById('admin-projects-list');
            const storeList = document.getElementById('admin-store-list');

            if (targetTab === 'store') {
                if (projectsTitle) projectsTitle.style.display = 'none';
                if (storeTitle) storeTitle.style.display = 'block';
                if (projectsList) projectsList.style.display = 'none';
                if (storeList) storeList.style.display = 'block';
                renderAdminStoreList();
            } else {
                // For other tabs show projects inventory by default
                if (projectsTitle) projectsTitle.style.display = 'block';
                if (storeTitle) storeTitle.style.display = 'none';
                if (projectsList) projectsList.style.display = 'block';
                if (storeList) storeList.style.display = 'none';
                renderAdminProjectsList();
            }
        });
    });
    // Save Profile settings
    if (adminProfileForm) {
        adminProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const updatedProfile = {
                whatsapp: document.getElementById('admin-prof-whatsapp').value.trim(),
                instagram: document.getElementById('admin-prof-instagram').value.trim(),
                email: document.getElementById('admin-prof-email').value.trim(),
                youtube: document.getElementById('admin-prof-youtube').value.trim(),
                address: document.getElementById('admin-prof-address').value.trim(),
                priceBasic: document.getElementById('admin-price-basic').value.trim(),
                priceIntermediate: document.getElementById('admin-price-intermediate').value.trim(),
                priceAdvanced: document.getElementById('admin-price-advanced').value.trim(),
                priceWeb: document.getElementById('admin-price-web').value.trim(),
                featuresBasic: document.getElementById('admin-features-basic').value.trim(),
                featuresIntermediate: document.getElementById('admin-features-intermediate').value.trim(),
                featuresAdvanced: document.getElementById('admin-features-advanced').value.trim(),
                featuresCustom: document.getElementById('admin-features-custom').value.trim(),
                featuresWeb: document.getElementById('admin-features-web').value.trim()
            };

            const data = await apiFetch('/api/profile', {
                method: 'PUT',
                body: JSON.stringify(updatedProfile)
            });

            if (data && data.success) {
                profile = data.profile;
                applyProfileSettings();
                showToast('Contact details and package prices updated successfully!', 'success');
            }
        });
    }

    // Save Passcode settings
    if (adminSecurityForm) {
        adminSecurityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPass = document.getElementById('admin-current-passcode').value;
            const newPass = document.getElementById('admin-new-passcode').value;
            const confirmPass = document.getElementById('admin-confirm-passcode').value;
            
            // 1. Verify new passcode matches confirm
            if (newPass !== confirmPass) {
                showToast('New passcodes do not match.', 'error');
                return;
            }
            
            // 2. Verify passcode is not empty
            if (newPass.trim() === '') {
                showToast('Passcode cannot be empty.', 'error');
                return;
            }
            
            const data = await apiFetch('/api/auth/change-passcode', {
                method: 'POST',
                body: JSON.stringify({ currentPasscode: currentPass, newPasscode: newPass })
            });

            if (data && data.success) {
                passcodeCustomized = true;
                updateAuthHint();
                showToast('Passcode updated successfully! All other admin sessions revoked.', 'success');
                adminSecurityForm.reset();
            } else if (data) {
                showToast(data.message || 'Passcode update failed.', 'error');
            }
        });
    }

    // Admin Logout Trigger
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('mktech_admin_authenticated');
            sessionStorage.removeItem('mktech_admin_token');
            showToast('Logged out from admin session.', 'info');
            window.location.href = 'index.html'; // Redirect to landing page on logout
        });
    }

    /* --------------------------------------------------------------------------
       11c. ADMIN STORE MANAGER CRUD
       -------------------------------------------------------------------------- */
    let uploadedStoreImageBase64 = '';
    let isEditingStoreProduct = false;
    let editStoreProductId = '';

    // Reset Store dropzone & previews
    function resetStoreImageUploadState() {
        uploadedStoreImageBase64 = '';
        if (adminStoreImageFile) adminStoreImageFile.value = '';
        if (adminStoreImagePreview) adminStoreImagePreview.src = '';
        if (adminStoreImagePreviewContainer) adminStoreImagePreviewContainer.style.display = 'none';
        if (adminStoreImageDropzone) adminStoreImageDropzone.style.display = 'block';
        if (adminStoreImageUrl) adminStoreImageUrl.value = '';
    }

    // File dropzone trigger click
    if (adminStoreImageDropzone) {
        adminStoreImageDropzone.addEventListener('click', () => {
            if (adminStoreImageFile) adminStoreImageFile.click();
        });
    }

    // File Drag/Drop Styling
    if (adminStoreImageDropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            adminStoreImageDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                adminStoreImageDropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            adminStoreImageDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                adminStoreImageDropzone.classList.remove('dragover');
            }, false);
        });

        // Dropzone Drop event
        adminStoreImageDropzone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            processStoreImageFile(file);
        });
    }

    // File input change handler (Base64 file reader)
    if (adminStoreImageFile) {
        adminStoreImageFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            processStoreImageFile(file);
        });
    }

    function processStoreImageFile(file) {
        if (!file) return;
        
        if (!file.type.match('image.*')) {
            showToast('Please select a valid image file (PNG/JPG).', 'error');
            return;
        }

        if (file.size > 1024 * 1024) { // 1MB limit for safety
            showToast('Image is too large. Keep file size under 1MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedStoreImageBase64 = event.target.result;
            
            // Set previews
            if (adminStoreImagePreview) adminStoreImagePreview.src = uploadedStoreImageBase64;
            if (adminStoreImageDropzone) adminStoreImageDropzone.style.display = 'none';
            if (adminStoreImagePreviewContainer) adminStoreImagePreviewContainer.style.display = 'block';
            
            // Clear text URL input to avoid conflict
            if (adminStoreImageUrl) adminStoreImageUrl.value = '';
        };
        reader.readAsDataURL(file);
    }

    // Remove uploaded image preview click
    if (adminStoreImageRemoveBtn) {
        adminStoreImageRemoveBtn.addEventListener('click', () => {
            resetStoreImageUploadState();
        });
    }

    // Render Admin store list
    function renderAdminStoreList() {
        if (!adminStoreList) return;
        adminStoreList.innerHTML = '';
        if (adminStoreCountSpan) adminStoreCountSpan.textContent = storeProducts.length;

        if (storeProducts.length === 0) {
            adminStoreList.innerHTML = `<p class="text-center" style="color: var(--text-secondary); padding: 20px 0;">No active store kits in database.</p>`;
            return;
        }

        storeProducts.forEach(prod => {
            const item = document.createElement('div');
            item.className = 'admin-item-card';
            
            const safeProdTitle = escapeHtml(prod.title);
            item.innerHTML = `
                <div class="admin-item-thumb">
                    <img src="${prod.image}" alt="${safeProdTitle}">
                </div>
                <div class="admin-item-details">
                    <h5>${safeProdTitle}</h5>
                    <span>₹${escapeHtml(prod.price)} (Stock: ${escapeHtml(String(prod.stock))})</span>
                </div>
                <div class="admin-item-actions">
                    <button type="button" class="action-icon-btn edit-store-btn" data-id="${prod.id}" title="Edit Kit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="action-icon-btn delete-store-btn" data-id="${prod.id}" title="Delete Kit">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            
            adminStoreList.appendChild(item);
        });

        // Delete button triggers
        adminStoreList.querySelectorAll('.delete-store-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const kid = btn.dataset.id;
                deleteStoreProduct(kid);
            });
        });

        // Edit button triggers
        adminStoreList.querySelectorAll('.edit-store-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const kid = btn.dataset.id;
                startEditStoreProduct(kid);
            });
        });
    }

    // Action CRUD: Delete Store Kit
    async function deleteStoreProduct(id) {
        const prodIndex = storeProducts.findIndex(p => p.id === id);
        if (prodIndex === -1) return;
        
        const title = storeProducts[prodIndex].title;
        
        if (confirm(`Are you sure you want to delete "${title}" store kit?`)) {
            const data = await apiFetch(`/api/store/${id}`, { method: 'DELETE' });
            if (data && data.success) {
                storeProducts.splice(prodIndex, 1);
                
                // Re-render
                renderAdminStoreList();
                showToast(`Deleted "${title}" successfully from store.`, 'success');
                
                // If deleting the active editing card, reset editing state
                if (isEditingStoreProduct && editStoreProductId === id) {
                    cancelStoreEditMode();
                }
            }
        }
    }

    // Action CRUD: Start Edit Store Kit
    function startEditStoreProduct(id) {
        const prod = storeProducts.find(p => p.id === id);
        if (!prod) return;

        isEditingStoreProduct = true;
        editStoreProductId = id;

        // Prefill text values
        if (adminStoreTitle) adminStoreTitle.value = prod.title;
        if (adminStoreCategory) adminStoreCategory.value = prod.category;
        if (adminStoreTags) adminStoreTags.value = prod.tags.join(', ');
        if (adminStorePrice) adminStorePrice.value = prod.price;
        if (adminStoreOrigPrice) adminStoreOrigPrice.value = prod.originalPrice || '';
        if (adminStoreStock) adminStoreStock.value = prod.stock;
        if (adminStoreDesc) adminStoreDesc.value = prod.description;
        if (adminStoreIncluded) adminStoreIncluded.value = prod.includedComponents;
        
        // Reset Visual uploader
        resetStoreImageUploadState();

        if (prod.image.startsWith('data:image') || prod.image.startsWith('/uploads/')) {
            // Uploaded image Base64 or local uploaded path preview
            if (adminStoreImagePreview) adminStoreImagePreview.src = prod.image;
            if (adminStoreImageDropzone) adminStoreImageDropzone.style.display = 'none';
            if (adminStoreImagePreviewContainer) adminStoreImagePreviewContainer.style.display = 'block';
        } else {
            // Unsplash / Absolute Image URL fallback
            if (adminStoreImageUrl) adminStoreImageUrl.value = prod.image;
        }

        // Toggle button layouts
        if (adminStoreCancelEditBtn) adminStoreCancelEditBtn.style.display = 'inline-flex';
        document.getElementById('admin-store-form-mode-title').textContent = `Edit Kit ID: ${prod.id}`;
        document.getElementById('admin-store-save-btn-element').querySelector('span').textContent = 'Save Changes';
        
        // Scroll to form panel if in mobile view
        document.querySelector('.admin-form-panel').scrollIntoView({ behavior: 'smooth' });
    }

    function cancelStoreEditMode() {
        isEditingStoreProduct = false;
        editStoreProductId = '';
        if (adminStoreForm) adminStoreForm.reset();
        resetStoreImageUploadState();
        
        if (adminStoreCancelEditBtn) adminStoreCancelEditBtn.style.display = 'none';
        const titleEl = document.getElementById('admin-store-form-mode-title');
        if (titleEl) titleEl.textContent = 'Create New Hardware Kit';
        const saveEl = document.getElementById('admin-store-save-btn-element');
        if (saveEl) saveEl.querySelector('span').textContent = 'Add Store Product';
    }

    if (adminStoreCancelEditBtn) {
        adminStoreCancelEditBtn.addEventListener('click', cancelStoreEditMode);
    }

    // Save Admin store form Submit
    if (adminStoreForm) {
        adminStoreForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = adminStoreTitle.value.trim();
            const category = adminStoreCategory.value;
            const rawTags = adminStoreTags.value;
            const price = parseFloat(adminStorePrice.value);
            const originalPriceVal = adminStoreOrigPrice.value.trim();
            const originalPrice = originalPriceVal ? parseFloat(originalPriceVal) : null;
            const stock = parseInt(adminStoreStock.value);
            const description = adminStoreDesc.value.trim();
            const includedComponents = adminStoreIncluded.value.trim();
            const urlInput = adminStoreImageUrl.value.trim();

            // Process Tags list
            const tags = rawTags.split(',')
                                .map(tag => tag.trim())
                                .filter(tag => tag.length > 0);

            // Get Visual Image value: Preference is base64 file upload, then absolute link, then generic fallback
            let image = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80';
            
            if (uploadedStoreImageBase64) {
                image = uploadedStoreImageBase64;
            } else if (urlInput) {
                image = urlInput;
            }

            const payload = {
                title,
                category,
                tags,
                price,
                originalPrice,
                stock,
                description,
                includedComponents,
                image
            };

            if (isEditingStoreProduct) {
                // UPDATE EXISTING
                const data = await apiFetch(`/api/store/${editStoreProductId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                
                if (data && data.success) {
                    const prodIndex = storeProducts.findIndex(p => p.id === editStoreProductId);
                    if (prodIndex !== -1) {
                        storeProducts[prodIndex] = data.product;
                    }
                    showToast(`Store kit "${title}" updated successfully!`, 'success');
                    renderAdminStoreList();
                    cancelStoreEditMode();
                }
            } else {
                // CREATE NEW
                const data = await apiFetch('/api/store', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (data && data.success) {
                    storeProducts.unshift(data.product); // Place newest first
                    showToast(`New Hardware Kit "${title}" added to store!`, 'success');
                    renderAdminStoreList();
                    cancelStoreEditMode();
                }
            }
        });
    }

    /* --------------------------------------------------------------------------
       12. CONTACT FORM SUBMISSION
       -------------------------------------------------------------------------- */
    let isSubmittingContact = false;
    if (mainContactForm) {
        mainContactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (isSubmittingContact) return;
            isSubmittingContact = true;
            
            const name = document.getElementById('contact-name').value.trim();
            const phone = document.getElementById('contact-phone').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const category = document.getElementById('contact-requirement-select').value;
            const message = document.getElementById('contact-message').value.trim();

            if (!phone && !email) {
                isSubmittingContact = false;
                showToast('Please provide at least a Phone Number or an Email Address.', 'error');
                return;
            }

            const submitBtn = mainContactForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const payload = {
                name,
                phone,
                email,
                category,
                project: '',
                message
            };

            fetch('/api/inquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (submitBtn) submitBtn.disabled = false;
                isSubmittingContact = false;
                if (data && data.success) {
                    inquiries.unshift(data.inquiry);
                    renderInbox();
                    showToast(`Thank you, ${name}! Your inquiry has been received and saved in Inbox.`, 'success');
                    mainContactForm.reset();
                } else {
                    showToast('Failed to submit message. Please try again.', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                if (submitBtn) submitBtn.disabled = false;
                isSubmittingContact = false;
                showToast('Network error submitting inquiry.', 'error');
            });
        });
    }

    // Clear All Inbox event listener
    const clearInboxBtn = document.getElementById('admin-clear-inbox-btn');
    if (clearInboxBtn) {
        clearInboxBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear your entire Inquiries Inbox?')) {
                const data = await apiFetch('/api/inquiries/clear', { method: 'POST' });
                if (data && data.success) {
                    inquiries = [];
                    renderInbox();
                    showToast('All inquiries cleared successfully.', 'success');
                }
            }
        });
    }

    // Auto-swap Hero Hardware Boards (Arduino Uno <-> ESP32 DevKit) every 4 seconds
    const arduinoBoard = document.querySelector('.board-arduino');
    const esp32Board = document.querySelector('.board-esp32');
    
    if (arduinoBoard && esp32Board) {
        setInterval(() => {
            if (arduinoBoard.classList.contains('active')) {
                arduinoBoard.classList.remove('active');
                esp32Board.classList.add('active');
            } else {
                esp32Board.classList.remove('active');
                arduinoBoard.classList.add('active');
            }
        }, 4000);
    }
});
