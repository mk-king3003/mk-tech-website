document.addEventListener('DOMContentLoaded', () => {
    
    let products = [];
    let profile = {};
    let activeCustomer = null;

    // API Base URL for cross-origin deployment (Netlify frontend + Render backend)
    const API_BASE = 'https://mk-tech-website.onrender.com';

    const productsGrid = document.getElementById('products-grid');
    const searchInput = document.getElementById('store-search');
    const filterPillsContainer = document.getElementById('store-filter-pills');
    const productDetailModal = document.getElementById('product-detail-modal');
    
    const checkoutForm = document.getElementById('store-checkout-form');
    const checkoutProductIdInput = document.getElementById('checkout-product-id');
    const modalProductTitleSpan = document.getElementById('modal-product-title');
    const modalProductIncludedP = document.getElementById('modal-product-included');
    const modalCheckoutPriceSpan = document.getElementById('modal-checkout-price');
    
    const modalCloseBtn = document.getElementById('product-modal-close');
    const toastContainer = document.getElementById('toast-container');
    const body = document.body;

    let currentCategory = 'all';
    let currentSearchQuery = '';

    /* --------------------------------------------------------------------------
       1. SYSTEM TOAST ALERTS
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
       2. SYNCED THEME CONTROLLER
       -------------------------------------------------------------------------- */
    const themeToggleBtn = document.getElementById('theme-toggle');
    
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
       3. RESPONSIVE MOBILE HAMBURGER
       -------------------------------------------------------------------------- */
    const hamburgerMenuBtn = document.getElementById('hamburger-menu');
    const navLinksList = document.getElementById('nav-links');

    if (hamburgerMenuBtn) {
        hamburgerMenuBtn.addEventListener('click', () => {
            hamburgerMenuBtn.classList.toggle('active');
            navLinksList.classList.toggle('active');
        });
    }

    // Close mobile nav when link is clicked
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (hamburgerMenuBtn) hamburgerMenuBtn.classList.remove('active');
            if (navLinksList) navLinksList.classList.remove('active');
        });
    });

    /* --------------------------------------------------------------------------
       4. GET SETTINGS & PROFILE FLOW
       -------------------------------------------------------------------------- */
    async function initProfile() {
        try {
            const response = await fetch(API_BASE + '/api/profile');
            profile = await response.json();
            applyProfileSettings();
        } catch (err) {
            console.error('Failed to load profile details:', err);
        }
    }

    function applyProfileSettings() {
        const cleanWhatsapp = profile.whatsapp.replace(/\D/g, '');
        
        // WhatsApp links in footer & social areas
        document.querySelectorAll('.dynamic-whatsapp-link').forEach(link => {
            link.href = `https://wa.me/${cleanWhatsapp}`;
        });

        // Instagram links
        document.querySelectorAll('.dynamic-instagram-link').forEach(link => {
            link.href = `https://instagram.com/${profile.instagram}`;
        });

        // YouTube links
        document.querySelectorAll('.dynamic-youtube-link').forEach(link => {
            link.href = profile.youtube.startsWith('http') ? profile.youtube : `https://youtube.com/c/${profile.youtube}`;
        });

        // Email links
        document.querySelectorAll('.dynamic-email-link').forEach(link => {
            link.href = `mailto:${profile.email}`;
        });

        // Text Elements
        document.querySelectorAll('.dynamic-whatsapp-text').forEach(el => {
            el.textContent = profile.whatsapp;
        });

        document.querySelectorAll('.dynamic-email-text').forEach(el => {
            el.textContent = profile.email;
        });

        document.querySelectorAll('.dynamic-address-text').forEach(el => {
            el.textContent = profile.address;
        });
    }

    /* --------------------------------------------------------------------------
       5. FETCH STORE CATALOG & GRID RENDER
       -------------------------------------------------------------------------- */
    async function initStore() {
        try {
            const response = await fetch(API_BASE + '/api/store');
            products = await response.json();
            renderStoreGrid();
        } catch (err) {
            console.error('Failed to fetch store inventory:', err);
            productsGrid.innerHTML = `
                <div class="loader-placeholder">
                    <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 2.5rem;"></i>
                    <p>Failed to load the store inventory. Please refresh or try again later.</p>
                </div>
            `;
        }
    }

    function renderStoreGrid() {
        productsGrid.innerHTML = '';

        if (!Array.isArray(products)) {
            productsGrid.innerHTML = `
                <div class="loader-placeholder" style="grid-column: 1 / -1; width: 100%;">
                    <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 2.5rem;"></i>
                    <p>Failed to load the store inventory. Invalid data format received.</p>
                </div>
            `;
            return;
        }

        const filtered = products.filter(prod => {
            const matchesCategory = (currentCategory === 'all') || 
                                    (prod.category.toLowerCase().includes(currentCategory.toLowerCase()));
            
            const searchLower = currentSearchQuery.toLowerCase();
            const matchesSearch = prod.title.toLowerCase().includes(searchLower) || 
                                  prod.description.toLowerCase().includes(searchLower) ||
                                  prod.tags.some(tag => tag.toLowerCase().includes(searchLower));
            
            return matchesCategory && matchesSearch;
        });

        if (filtered.length === 0) {
            productsGrid.innerHTML = `
                <div class="loader-placeholder" style="grid-column: 1 / -1; width: 100%;">
                    <i class="fa-solid fa-ban" style="font-size: 2.5rem;"></i>
                    <p>No hardware kits match your search filters. Try clearing details!</p>
                </div>
            `;
            return;
        }

        filtered.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            // Render stock tag
            let stockTagHTML = `<span class="product-stock-tag in-stock">In Stock (${prod.stock})</span>`;
            let buyButtonHTML = `<button class="btn btn-primary buy-btn" data-id="${prod.id}">Buy Now <i class="fa-solid fa-cart-shopping"></i></button>`;
            
            if (prod.stock === 0) {
                stockTagHTML = `<span class="product-stock-tag out-of-stock">Out of Stock</span>`;
                buyButtonHTML = `<button class="btn btn-secondary" disabled style="cursor: not-allowed; opacity: 0.6;">Sold Out <i class="fa-solid fa-ban"></i></button>`;
            } else if (prod.stock <= 2) {
                stockTagHTML = `<span class="product-stock-tag low-stock">Only ${prod.stock} Left!</span>`;
            }

            // Render tags
            const tagsHTML = prod.tags.map(tag => `<span class="project-tag">${tag}</span>`).join('');
            
            // Render original price strikeout if available
            const origPriceHTML = prod.originalPrice ? `<span class="original-price">₹${prod.originalPrice}</span>` : '';

            card.innerHTML = `
                <div class="product-image-container">
                    ${stockTagHTML}
                    <img src="${prod.image}" alt="${prod.title}" loading="lazy">
                </div>
                <div class="product-info-panel">
                    <div>
                        <span class="product-category-text">${prod.category}</span>
                        <h3 class="product-title-text">${prod.title}</h3>
                        <p class="product-desc-text">${prod.description}</p>
                        <div class="project-tags" style="margin-bottom: 20px;">${tagsHTML}</div>
                    </div>
                    
                    <div class="product-features-box">
                        <strong>Kit Materials Included:</strong>
                        <p style="color: var(--text-secondary); margin-bottom: 0; line-height: 1.4; font-size: 0.8rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${prod.includedComponents}</p>
                    </div>

                    <div class="product-price-row">
                        <div class="price-wrapper">
                            ${origPriceHTML}
                            <span class="retail-price">₹${prod.price}</span>
                        </div>
                        ${buyButtonHTML}
                    </div>
                </div>
            `;

            productsGrid.appendChild(card);
        });

        // Bind Purchase triggers
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const kitId = btn.dataset.id;
                openCheckoutModal(kitId);
            });
        });
    }

    // Filter pills listener
    if (filterPillsContainer) {
        filterPillsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill')) {
                document.querySelectorAll('#store-filter-pills .pill').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                currentCategory = e.target.dataset.category;
                renderStoreGrid();
            }
        });
    }

    // Search input listener
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderStoreGrid();
        });
    }

    /* --------------------------------------------------------------------------
       6. CHECKOUT MODAL LOGIC
       -------------------------------------------------------------------------- */
    function openModal(modal) {
        modal.classList.add('active');
        body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        modal.classList.remove('active');
        body.style.overflow = '';
    }

    function openCheckoutModal(productId) {
        const prod = products.find(p => p.id === productId);
        if (!prod) return;

        // Reset the form values first before populating details to avoid hidden field reset bugs (B3)
        checkoutForm.reset();

        checkoutProductIdInput.value = prod.id;
        modalProductTitleSpan.textContent = prod.title;
        modalProductIncludedP.textContent = prod.includedComponents;
        modalCheckoutPriceSpan.textContent = prod.price;

        // Reset quantity select field if it exists
        const quantitySelect = document.getElementById('checkout-quantity');
        if (quantitySelect) quantitySelect.value = "1";
        
        // AUTOFILL customer fields if logged in
        if (activeCustomer) {
            const checkoutNameInput = document.getElementById('checkout-name');
            const checkoutPhoneInput = document.getElementById('checkout-phone');
            const checkoutAddressInput = document.getElementById('checkout-address');

            if (checkoutNameInput) checkoutNameInput.value = activeCustomer.name;
            if (checkoutPhoneInput) checkoutPhoneInput.value = activeCustomer.phone;
            if (checkoutAddressInput) checkoutAddressInput.value = activeCustomer.address;
        }

        openModal(productDetailModal);
    }

    modalCloseBtn.addEventListener('click', () => closeModal(productDetailModal));

    window.addEventListener('click', (e) => {
        if (e.target === productDetailModal) closeModal(productDetailModal);
    });

    /* --------------------------------------------------------------------------
       7. CHECKOUT SUBMIT HANDLER (WHATSAPP REDIRECT / EMAIL API)
       -------------------------------------------------------------------------- */
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('checkout-name').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const email = document.getElementById('checkout-email').value.trim();
        const address = document.getElementById('checkout-address').value.trim();
        const quantitySelect = document.getElementById('checkout-quantity');
        const quantity = quantitySelect ? parseInt(quantitySelect.value, 10) : 1;
        
        const prodId = checkoutProductIdInput.value;
        const prod = products.find(p => p.id === prodId);
        if (!prod) return;

        const submitBtn = checkoutForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        const unitPrice = parseFloat(prod.price.replace(/,/g, '')) || 0;
        const totalPrice = unitPrice * quantity;
        const formattedPrice = totalPrice.toLocaleString('en-IN');

        const cleanWhatsapp = profile.whatsapp.replace(/\D/g, '');

        const checkoutText = `Hi MK Tech!\n\nI want to place an order for the hardware kit: *${prod.title}*.\n\n*My Details:*\n- Name: ${name}\n- Phone: ${phone}\n- Email: ${email}\n\n*Shipping Address:*\n${address}\n\n*Order Summary:*\n- Item: ${prod.title}\n- Quantity: *${quantity} unit(s)*\n- Total Price: *₹${formattedPrice}*\n- Payment: *Cash on Delivery*`;
        const encodedText = encodeURIComponent(checkoutText);
        const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedText}`;

        closeModal(productDetailModal);
        showToast('Redirecting to WhatsApp to complete your COD order...', 'success');
        if (submitBtn) submitBtn.disabled = false;
        window.open(whatsappUrl, '_blank');
    });

    // Live price calculation listener when changing quantities (UX5)
    const quantitySelectField = document.getElementById('checkout-quantity');
    if (quantitySelectField) {
        quantitySelectField.addEventListener('change', () => {
            const prodId = checkoutProductIdInput.value;
            const prod = products.find(p => p.id === prodId);
            if (!prod) return;
            const quantity = parseInt(quantitySelectField.value, 10) || 1;
            const unitPrice = parseFloat(prod.price.replace(/,/g, '')) || 0;
            modalCheckoutPriceSpan.textContent = (unitPrice * quantity).toLocaleString('en-IN');
        });
    }

    /* --------------------------------------------------------------------------
       8. CUSTOMER AUTHENTICATION & PORTAL LOGIC
       -------------------------------------------------------------------------- */
    // DOM Selections for Customer Portal
    const btnCustomerPortal = document.getElementById('btn-customer-portal');
    const customerNavBtnText = document.getElementById('customer-nav-btn-text');
    const customerAuthModal = document.getElementById('customer-auth-modal');
    const customerModalClose = document.getElementById('customer-modal-close');

    const custStateLookup = document.getElementById('cust-state-lookup');
    const custStateRegister = document.getElementById('cust-state-register');
    const custStateProfile = document.getElementById('cust-state-profile');

    const custLookupForm = document.getElementById('cust-lookup-form');
    const custLookupPhone = document.getElementById('cust-lookup-phone');

    const custRegisterForm = document.getElementById('cust-register-form');
    const custRegPhone = document.getElementById('cust-reg-phone');
    const custRegName = document.getElementById('cust-reg-name');
    const custRegAddress = document.getElementById('cust-reg-address');
    const custRegBackBtn = document.getElementById('cust-reg-back-btn');

    const custProfileForm = document.getElementById('cust-profile-form');
    const custProfPhone = document.getElementById('cust-prof-phone');
    const custProfName = document.getElementById('cust-prof-name');
    const custProfAddress = document.getElementById('cust-prof-address');
    const custProfileWelcome = document.getElementById('cust-profile-welcome');
    const custProfileLogoutBtn = document.getElementById('cust-profile-logout-btn');

    // Load active customer session from LocalStorage
    function initCustomerSession() {
        const savedSession = localStorage.getItem('mktech_customer_session');
        if (savedSession) {
            try {
                activeCustomer = JSON.parse(savedSession);
                updateCustomerUI();
            } catch (err) {
                console.error('Failed to parse customer session:', err);
                localStorage.removeItem('mktech_customer_session');
            }
        }
    }

    // Toggle Portal Modal View States
    function showCustomerModalState(state) {
        custStateLookup.style.display = 'none';
        custStateRegister.style.display = 'none';
        custStateProfile.style.display = 'none';

        if (state === 'lookup') {
            custStateLookup.style.display = 'block';
            if (custLookupForm) custLookupForm.reset();
        } else if (state === 'register') {
            custStateRegister.style.display = 'block';
        } else if (state === 'profile') {
            custStateProfile.style.display = 'block';
            if (activeCustomer) {
                if (custProfPhone) custProfPhone.value = activeCustomer.phone;
                if (custProfName) custProfName.value = activeCustomer.name;
                if (custProfAddress) custProfAddress.value = activeCustomer.address;
                if (custProfileWelcome) custProfileWelcome.textContent = `Welcome, ${activeCustomer.name.split(' ')[0]}!`;
            }
        }
    }

    // Update Navbar login badge
    function updateCustomerUI() {
        if (activeCustomer) {
            if (customerNavBtnText) {
                // Short name to keep styling neat
                const firstName = activeCustomer.name.split(' ')[0];
                customerNavBtnText.textContent = `Hi, ${firstName}`;
            }
            if (btnCustomerPortal) {
                btnCustomerPortal.title = "View saved profile & address";
            }
        } else {
            if (customerNavBtnText) {
                customerNavBtnText.textContent = "Customer Login";
            }
            if (btnCustomerPortal) {
                btnCustomerPortal.title = "Customer Login / Portal";
            }
        }
    }

    // Click trigger for customer login button
    if (btnCustomerPortal) {
        btnCustomerPortal.addEventListener('click', () => {
            if (activeCustomer) {
                showCustomerModalState('profile');
            } else {
                showCustomerModalState('lookup');
            }
            openModal(customerAuthModal);
        });
    }

    if (customerModalClose) {
        customerModalClose.addEventListener('click', () => closeModal(customerAuthModal));
    }

    // Click outside closes modal
    window.addEventListener('click', (e) => {
        if (e.target === customerAuthModal) closeModal(customerAuthModal);
    });

    // Lookup Form submit: check if customer exists by phone number
    if (custLookupForm) {
        custLookupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = custLookupPhone.value.trim();

            if (!phone) return;

            try {
                const response = await fetch(API_BASE + '/api/customer/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone })
                });
                const data = await response.json();

                if (response.ok && data && data.success) {
                    if (data.exists) {
                        // Customer profile exists: Login them immediately!
                        activeCustomer = data.customer;
                        localStorage.setItem('mktech_customer_session', JSON.stringify(activeCustomer));
                        updateCustomerUI();
                        showToast(`Logged in successfully! Welcome back, ${activeCustomer.name}.`, 'success');
                        closeModal(customerAuthModal);
                    } else {
                        // Customer does not exist: Transition to registration state
                        if (custRegPhone) custRegPhone.value = phone;
                        if (custRegisterForm) custRegisterForm.reset();
                        showCustomerModalState('register');
                    }
                } else {
                    showToast(data.message || 'Lookup failed. Please check details.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Lookup failed. Check network connection.', 'error');
            }
        });
    }

    // Register Form back button
    if (custRegBackBtn) {
        custRegBackBtn.addEventListener('click', () => {
            showCustomerModalState('lookup');
        });
    }

    // Register Form submit: create new customer profile
    if (custRegisterForm) {
        custRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = custRegName.value.trim();
            const phone = custRegPhone.value.trim();
            const address = custRegAddress.value.trim();

            if (!name || !phone || !address) {
                showToast('Please fill all fields to register your profile.', 'error');
                return;
            }

            try {
                const response = await fetch(API_BASE + '/api/customer/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, phone, address })
                });
                const data = await response.json();

                if (response.ok && data && data.success) {
                    activeCustomer = data.customer;
                    localStorage.setItem('mktech_customer_session', JSON.stringify(activeCustomer));
                    updateCustomerUI();
                    showToast(`Registration complete! Profile created for ${activeCustomer.name}.`, 'success');
                    closeModal(customerAuthModal);
                } else {
                    showToast(data.message || 'Failed to complete registration.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Registration failed due to network issue.', 'error');
            }
        });
    }

    // Profile Settings Form submit: update details
    if (custProfileForm) {
        custProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = custProfName.value.trim();
            const address = custProfAddress.value.trim();
            const phone = custProfPhone.value.trim();

            if (!name || !address) {
                showToast('Name and Address are required.', 'error');
                return;
            }

            try {
                const response = await fetch(API_BASE + '/api/customer/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, phone, address })
                });
                const data = await response.json();

                if (response.ok && data && data.success) {
                    activeCustomer = data.customer;
                    localStorage.setItem('mktech_customer_session', JSON.stringify(activeCustomer));
                    updateCustomerUI();
                    showToast('Profile and Delivery address saved successfully!', 'success');
                    closeModal(customerAuthModal);
                } else {
                    showToast(data.message || 'Failed to save updates.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to save profile. Network error.', 'error');
            }
        });
    }

    // Logout customer session
    if (custProfileLogoutBtn) {
        custProfileLogoutBtn.addEventListener('click', () => {
            activeCustomer = null;
            localStorage.removeItem('mktech_customer_session');
            updateCustomerUI();
            showToast('Logged out of customer session.', 'info');
            closeModal(customerAuthModal);
        });
    }

    // Initialize Page
    initProfile();
    initStore();
    initCustomerSession();
});
