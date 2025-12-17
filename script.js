// Curriculum Planner Application
class CurriculumPlanner {
    constructor() {
        this.curriculum = null;
        this.completedTasks = new Set();
        this.theme = 'light';
        this.currentUser = null;
        this.userToken = null;

        this.init();
    }

    async init() {
        await this.loadCurriculum();
        await this.checkAuthState();
        this.loadProgress();
        this.setupEventListeners();
        this.renderCurriculum();
        this.updateStats();
        this.applyTheme();
    }

    async loadCurriculum() {
        try {
            const response = await fetch('ux_ui_curriculum.json');
            this.curriculum = await response.json();
        } catch (error) {
            console.error('Error loading curriculum:', error);
            this.showError('Failed to load curriculum data. Please refresh the page.');
        }
    }

    async checkAuthState() {
        try {
            // Check if user is authenticated via API
            const response = await fetch('/api/auth', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.userToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.updateAuthUI();
                await this.loadProgressFromDB();
            } else {
                // API not available, use local mode
                this.enableLocalMode();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            // API not available, use local mode
            this.enableLocalMode();
        }
    }

    enableLocalMode() {
        console.log('🔧 Running in local mode - using localStorage');
        this.currentUser = null;
        this.userToken = null;
        this.updateAuthUI();
        this.loadProgress(); // Use localStorage

        // Show local mode indicator
        this.showLocalModeNotification();
    }

    showLocalModeNotification() {
        const notification = document.createElement('div');
        notification.className = 'local-mode-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-info-circle"></i>
                <span>Running in local mode - data saved to browser storage</span>
                <button onclick="this.parentElement.parentElement.remove()" class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    loadProgress() {
        const saved = localStorage.getItem('curriculum-progress');
        if (saved) {
            this.completedTasks = new Set(JSON.parse(saved));
        }
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.theme = savedTheme;
        }
    }

    async loadProgressFromDB() {
        if (!this.currentUser || !this.userToken) return;

        try {
            const response = await fetch('/api/progress', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.userToken}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Convert DB progress to Set format
                this.completedTasks = new Set(
                    data.progress
                        .filter(p => p.completed)
                        .map(p => `${p.week_number}-${p.task_day}`)
                );
            }
        } catch (error) {
            console.error('Failed to load progress from DB:', error);
        }
    }

    saveProgress() {
        localStorage.setItem('curriculum-progress', JSON.stringify([...this.completedTasks]));
        localStorage.setItem('theme', this.theme);

        // Also save to database if user is authenticated
        if (this.currentUser && this.userToken) {
            this.saveProgressToDB();
        }
    }

    async saveProgressToDB() {
        if (!this.currentUser || !this.userToken) return;

        try {
            // Get all progress data to sync
            const progressData = Array.from(this.completedTasks).map(taskId => {
                const [weekNumber, taskDay] = taskId.split('-');
                return {
                    weekNumber: parseInt(weekNumber),
                    taskDay,
                    completed: true
                };
            });

            // Sync each progress item
            for (const progress of progressData) {
                await fetch('/api/progress', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.userToken}`
                    },
                    body: JSON.stringify(progress)
                });
            }
        } catch (error) {
            console.error('Failed to save progress to DB:', error);
        }
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Progress modal
        document.getElementById('progress-view').addEventListener('click', () => {
            this.showProgressModal();
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Reflection modal
        document.getElementById('reflection-save-btn').addEventListener('click', () => {
            this.saveReflections(false);
        });

        document.getElementById('reflection-submit-btn').addEventListener('click', () => {
            this.saveReflections(true);
        });

        // Portfolio modal
        document.getElementById('portfolio-submit-btn').addEventListener('click', () => {
            this.submitPortfolioMilestone();
        });

        // Assignment modal
        document.getElementById('assignment-submit-btn').addEventListener('click', () => {
            this.submitAssignment();
        });

        // File upload
        this.initFileUpload();

        // Authentication
        document.getElementById('auth-btn').addEventListener('click', () => {
            if (this.currentUser) {
                this.toggleUserMenu();
            } else {
                this.showAuthModal();
            }
        });

        document.getElementById('sign-out-btn').addEventListener('click', () => {
            this.signOut();
        });

        // Auth modal
        document.getElementById('auth-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });

        document.getElementById('auth-toggle-btn').addEventListener('click', () => {
            this.toggleAuthMode();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModals();
            });
        });

        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModals();
                }
            });
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.saveProgress();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    switchTab(tabName) {
        // Prevent multiple rapid clicks with timeout protection
        if (this.isTabSwitching) {
            console.log('Tab switch already in progress, ignoring click');
            return;
        }

        // Set flag with automatic reset after 10 seconds as safety net
        this.isTabSwitching = true;
        const safetyTimeout = setTimeout(() => {
            console.warn('Tab switching safety timeout triggered for', tabName);
            this.isTabSwitching = false;
        }, 10000);

        try {
            // Update tab buttons immediately
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });

            // Show loading state for content-heavy tabs
            const targetContent = document.getElementById(`${tabName}-tab`);
            if (['portfolio', 'analytics', 'mywork'].includes(tabName) && !targetContent.dataset.loaded) {
                this.showTabLoading(tabName);
            }

            // Update tab content visibility
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === `${tabName}-tab`);
            });

            // Render content based on tab with timeout protection
            if (tabName === 'resources') {
                this.renderResources();
                this.isTabSwitching = false;
                clearTimeout(safetyTimeout);
            } else if (tabName === 'portfolio') {
                // Add timeout to renderPortfolio
                const portfolioTimeout = setTimeout(() => {
                    console.error('Portfolio render timeout');
                    this.hideTabLoading('portfolio');
                    this.showTabError('portfolio', 'Loading timed out. Please try again.');
                }, 8000);

                this.renderPortfolio()
                    .then(() => {
                        clearTimeout(portfolioTimeout);
                    })
                    .catch(error => {
                        console.error('Portfolio render error:', error);
                        clearTimeout(portfolioTimeout);
                        this.hideTabLoading('portfolio');
                        this.showTabError('portfolio', 'Failed to load portfolio. Please try again.');
                    })
                    .finally(() => {
                        this.isTabSwitching = false;
                        clearTimeout(safetyTimeout);
                    });
            } else if (tabName === 'analytics') {
                // Add timeout to renderAnalytics
                const analyticsTimeout = setTimeout(() => {
                    console.error('Analytics render timeout');
                    this.hideTabLoading('analytics');
                    this.showTabError('analytics', 'Loading timed out. Please try again.');
                }, 8000);

                this.renderAnalytics()
                    .then(() => {
                        clearTimeout(analyticsTimeout);
                    })
                    .catch(error => {
                        console.error('Analytics render error:', error);
                        clearTimeout(analyticsTimeout);
                        this.hideTabLoading('analytics');
                        this.showTabError('analytics', 'Failed to load analytics. Please try again.');
                    })
                    .finally(() => {
                        this.isTabSwitching = false;
                        clearTimeout(safetyTimeout);
                    });
            } else if (tabName === 'mywork') {
                // Add timeout to renderMyWork
                const myworkTimeout = setTimeout(() => {
                    console.error('My Work render timeout');
                    this.hideTabLoading('mywork');
                    this.showTabError('mywork', 'Loading timed out. Please try again.');
                }, 8000);

                this.renderMyWork()
                    .then(() => {
                        clearTimeout(myworkTimeout);
                    })
                    .catch(error => {
                        console.error('My Work render error:', error);
                        clearTimeout(myworkTimeout);
                        this.hideTabLoading('mywork');
                        this.showTabError('mywork', 'Failed to load work. Please try again.');
                    })
                    .finally(() => {
                        this.isTabSwitching = false;
                        clearTimeout(safetyTimeout);
                    });
            } else {
                // Curriculum tab - no async operations
                this.isTabSwitching = false;
                clearTimeout(safetyTimeout);
            }
        } catch (error) {
            console.error('Tab switching error:', error);
            this.isTabSwitching = false;
            clearTimeout(safetyTimeout);
        }
    }

    showTabLoading(tabName) {
        const container = document.querySelector(`#${tabName}-tab .${tabName}-content`);
        if (!container) return;

        const loadingHTML = `
            <div class="tab-loading">
                <div class="loading-spinner"></div>
                <p>Loading ${tabName.replace(/^\w/, c => c.toUpperCase())}...</p>
            </div>
        `;

        // Keep existing content but overlay loading
        const existingContent = container.innerHTML;
        if (!existingContent.includes('tab-loading')) {
            container.innerHTML = loadingHTML + existingContent;
        }
    }

    hideTabLoading(tabName) {
        const loadingEl = document.querySelector(`#${tabName}-tab .tab-loading`);
        if (loadingEl) {
            loadingEl.remove();
        }

        // Mark as loaded
        const tabContent = document.getElementById(`${tabName}-tab`);
        tabContent.dataset.loaded = 'true';
    }

    showTabError(tabName, message) {
        const container = document.querySelector(`#${tabName}-tab .${tabName}-content`);
        if (!container) return;

        const errorHTML = `
            <div class="tab-error">
                <div class="error-content">
                    <i class="fas fa-exclamation-triangle error-icon"></i>
                    <h3>Loading Error</h3>
                    <p>${message}</p>
                    <button class="retry-btn" onclick="window.curriculumPlanner.switchTab('${tabName}')">
                        <i class="fas fa-redo"></i>
                        Try Again
                    </button>
                </div>
            </div>
        `;

        // Replace existing content or append to empty container
        container.innerHTML = errorHTML;
    }

    renderCurriculum() {
        const container = document.getElementById('curriculum-weeks');
        container.innerHTML = '';

        this.curriculum.weeks.forEach(week => {
            const weekCard = this.createWeekCard(week);
            container.appendChild(weekCard);
        });
    }

    renderResources() {
        const container = document.getElementById('resources-content');
        container.innerHTML = '';

        // Group resources by week
        const resourcesByWeek = {};

        this.curriculum.weeks.forEach(week => {
            resourcesByWeek[week.week_number] = {
                title: week.title,
                resources: []
            };

            week.daily_tasks.forEach(task => {
                if (task.resource_link) {
                    resourcesByWeek[week.week_number].resources.push({
                        day: task.day,
                        description: task.description,
                        link: task.resource_link,
                        deliverable: task.deliverable
                    });
                }
            });
        });

        // Create resource sections for each week
        Object.keys(resourcesByWeek).forEach(weekNumber => {
            const weekData = resourcesByWeek[weekNumber];
            if (weekData.resources.length > 0) {
                const weekSection = this.createResourceWeekSection(weekNumber, weekData);
                container.appendChild(weekSection);
            }
        });
    }

    createResourceWeekSection(weekNumber, weekData) {
        const section = document.createElement('div');
        section.className = 'resource-week-section';

        section.innerHTML = `
            <div class="resource-week-header">
                <h3>Week ${weekNumber}: ${weekData.title}</h3>
                <span class="resource-count">${weekData.resources.length} resources</span>
            </div>
            <div class="resource-list">
                ${weekData.resources.map(resource => `
                    <div class="resource-item">
                        <div class="resource-info">
                            <div class="resource-day">${resource.day}</div>
                            <div class="resource-description">${resource.description}</div>
                            <div class="resource-deliverable">
                                <strong>Deliverable:</strong> ${resource.deliverable}
                            </div>
                        </div>
                        <a href="${resource.link}" target="_blank" class="resource-link-btn">
                            <i class="fas fa-external-link-alt"></i>
                            Open Resource
                        </a>
                    </div>
                `).join('')}
            </div>
        `;

        return section;
    }

    async renderPortfolio() {
        const container = document.getElementById('portfolio-content');
        if (!container) return;

        // Clear any existing error states
        container.innerHTML = '';

        if (!this.currentUser) {
            this.hideTabLoading('portfolio');
            container.innerHTML = `
                <div class="portfolio-signin-prompt">
                    <h3>Please sign in to view your portfolio</h3>
                    <p>Track your major portfolio milestones and build your design portfolio.</p>
                    <button onclick="document.getElementById('auth-btn').click()" class="signin-btn">
                        Sign In to View Portfolio
                    </button>
                </div>
            `;
            return;
        }

        try {
            // Fetch portfolio data with timeout and better error handling
            const portfolioPromise = fetch('/api/portfolio', {
                headers: { 'Authorization': `Bearer ${this.userToken}` },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            const portfolioResult = await Promise.resolve(
                portfolioPromise.then(async (response) => ({
                    success: response.ok,
                    data: response.ok ? await response.json() : { portfolio: [] }
                })).catch(error => {
                    if (error.name === 'TimeoutError') {
                        throw new Error('Request timed out');
                    }
                    throw error;
                })
            );

            const userPortfolio = portfolioResult.data.portfolio || [];

            // Get portfolio milestones from curriculum
            const portfolioMilestones = this.getPortfolioMilestonesFromCurriculum();

            // Create portfolio grid with optimized DOM creation
            const portfolioGrid = document.createElement('div');
            portfolioGrid.className = 'portfolio-grid';

            // Use DocumentFragment for better performance
            const fragment = document.createDocumentFragment();
            portfolioMilestones.forEach(milestone => {
                const userMilestone = userPortfolio.find(p => p.week_number === milestone.weekNumber);
                const milestoneCard = this.createPortfolioMilestoneCard(milestone, userMilestone);
                fragment.appendChild(milestoneCard);
            });
            portfolioGrid.appendChild(fragment);

            // Hide loading and update content
            this.hideTabLoading('portfolio');
            container.appendChild(portfolioGrid);

        } catch (error) {
            console.error('Portfolio loading error:', error);
            this.hideTabLoading('portfolio');

            const errorMessage = error.message === 'Request timed out'
                ? 'Request timed out. Please check your connection.'
                : 'Failed to load portfolio data. Please try again.';

            container.innerHTML = `
                <div class="portfolio-error">
                    <i class="fas fa-exclamation-triangle error-icon"></i>
                    <h3>Failed to load portfolio</h3>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="window.curriculumPlanner.switchTab('portfolio')">
                        <i class="fas fa-redo"></i>
                        Try Again
                    </button>
                </div>
            `;
            throw error; // Re-throw so the timeout handler catches it
        }
    }

    getPortfolioMilestonesFromCurriculum() {
        const milestones = [];

        this.curriculum.weeks.forEach(week => {
            if (week.portfolio_milestones && week.portfolio_milestones.length > 0) {
                week.portfolio_milestones.forEach(milestone => {
                    milestones.push({
                        weekNumber: week.week_number,
                        weekTitle: week.title,
                        ...milestone
                    });
                });
            }
        });

        return milestones;
    }

    createPortfolioMilestoneCard(milestone, userMilestone) {
        const card = document.createElement('div');
        card.className = `portfolio-milestone-card ${userMilestone ? 'submitted' : 'pending'}`;

        const status = userMilestone ? userMilestone.status : 'pending';
        const statusText = {
            'pending': 'Not Started',
            'in_progress': 'In Progress',
            'submitted': 'Submitted',
            'completed': 'Completed'
        };

        card.innerHTML = `
            <div class="milestone-header">
                <div class="milestone-week">Week ${milestone.weekNumber}</div>
                <div class="milestone-status status-${status}">${statusText[status]}</div>
            </div>
            <div class="milestone-content">
                <h3 class="milestone-title">${milestone.title}</h3>
                <p class="milestone-description">${milestone.description}</p>
                <div class="milestone-deliverables">
                    <h4>Deliverables:</h4>
                    <ul>
                        ${milestone.deliverables.map(deliverable => `
                            <li>${deliverable}</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
            <div class="milestone-actions">
                <button class="milestone-btn ${userMilestone ? 'view-btn' : 'submit-btn'}"
                        data-week="${milestone.weekNumber}"
                        data-title="${milestone.title}"
                        data-description="${milestone.description}"
                        data-deliverables="${JSON.stringify(milestone.deliverables)}">
                    ${userMilestone ? 'View Submission' : 'Submit Milestone'}
                </button>
            </div>
        `;

        // Add click handler
        const actionBtn = card.querySelector('.milestone-btn');
        actionBtn.addEventListener('click', () => {
            const milestoneData = {
                weekNumber: milestone.weekNumber,
                title: milestone.title,
                description: milestone.description,
                deliverables: milestone.deliverables
            };
            this.openPortfolioModal(milestoneData, userMilestone);
        });

        return card;
    }

    openPortfolioModal(milestoneData, userMilestone) {
        const modal = document.getElementById('portfolio-modal');
        const title = document.getElementById('portfolio-modal-title');
        const info = document.getElementById('portfolio-milestone-info');
        const form = document.getElementById('portfolio-form');
        const deliverablesList = document.getElementById('deliverables-list');

        title.textContent = userMilestone ? 'View Portfolio Milestone' : 'Submit Portfolio Milestone';

        info.innerHTML = `
            <div class="milestone-info">
                <h4>Week ${milestoneData.weekNumber}: ${milestoneData.title}</h4>
                <p>${milestoneData.description}</p>
            </div>
        `;

        deliverablesList.innerHTML = milestoneData.deliverables.map(deliverable => `
            <label class="deliverable-item">
                <input type="checkbox" value="${deliverable}" ${userMilestone ? 'disabled' : ''}>
                <span>${deliverable}</span>
            </label>
        `).join('');

        if (userMilestone) {
            // View mode
            document.getElementById('portfolio-description').value = userMilestone.description || '';
            document.getElementById('portfolio-links').value = userMilestone.project_links ? userMilestone.project_links[0] : '';

            // Check submitted deliverables
            if (userMilestone.deliverables) {
                userMilestone.deliverables.forEach(deliverable => {
                    const checkbox = deliverablesList.querySelector(`input[value="${deliverable}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            document.getElementById('portfolio-submit-btn').textContent = 'Update Submission';
            form.dataset.milestoneId = userMilestone.id;
        } else {
            // Submit mode
            form.reset();
            document.getElementById('portfolio-submit-btn').textContent = 'Submit Milestone';
            delete form.dataset.milestoneId;
        }

        modal.classList.add('show');
    }

    async submitPortfolioMilestone() {
        if (!this.currentUser || !this.userToken) {
            alert('Please sign in to submit portfolio milestones');
            return;
        }

        const form = document.getElementById('portfolio-form');
        const milestoneId = form.dataset.milestoneId;
        const description = document.getElementById('portfolio-description').value.trim();
        const projectLinks = [document.getElementById('portfolio-links').value.trim()].filter(link => link);

        const checkedDeliverables = Array.from(document.querySelectorAll('#deliverables-list input:checked'))
            .map(checkbox => checkbox.value);

        if (!description) {
            this.showPortfolioMessage('Please provide a project description', 'error');
            return;
        }

        const submitBtn = document.getElementById('portfolio-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = milestoneId ? 'Updating...' : 'Submitting...';

        try {
            const response = await fetch('/api/portfolio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.userToken}`
                },
                body: JSON.stringify({
                    weekNumber: parseInt(form.closest('.modal').querySelector('.milestone-info h4').textContent.match(/Week (\d+)/)[1]),
                    milestoneTitle: form.closest('.modal').querySelector('.milestone-info h4').textContent.split(': ')[1],
                    description,
                    deliverables: checkedDeliverables,
                    projectLinks
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showPortfolioMessage(
                    milestoneId ? 'Portfolio milestone updated successfully!' : 'Portfolio milestone submitted successfully!',
                    'success'
                );
                setTimeout(() => {
                    this.closeModals();
                    this.renderPortfolio();
                }, 1500);
            } else {
                this.showPortfolioMessage(data.error || 'Failed to submit milestone', 'error');
            }
        } catch (error) {
            console.error('Portfolio submission error:', error);
            this.showPortfolioMessage('Network error. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = milestoneId ? 'Update Submission' : 'Submit Milestone';
        }
    }

    showPortfolioMessage(message, type) {
        const messageEl = document.getElementById('portfolio-message');
        messageEl.textContent = message;
        messageEl.className = `portfolio-message ${type}`;
        messageEl.classList.remove('hidden');
    }

    initFileUpload() {
        const uploadZone = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('file-input');
        const uploadLink = document.querySelector('.upload-link');

        // Click to browse files
        uploadLink.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag and drop functionality
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');

            const files = Array.from(e.dataTransfer.files);
            this.addFiles(files);
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.addFiles(files);
        });
    }

    addFiles(files) {
        const validFiles = files.filter(file => this.validateFile(file));

        if (validFiles.length !== files.length) {
            this.showAssignmentMessage('Some files were skipped due to size or type restrictions', 'error');
        }

        validFiles.forEach(file => {
            this.uploadFile(file);
        });
    }

    validateFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'text/plain', 'text/markdown',
            'application/zip', 'application/x-zip-compressed'
        ];

        return file.size <= maxSize && allowedTypes.includes(file.type);
    }

    async uploadFile(file) {
        if (!this.currentUser || !this.userToken) {
            alert('Please sign in to upload files');
            return;
        }

        // Create file item in UI
        const fileItem = this.createFileItem(file);
        document.getElementById('file-list').appendChild(fileItem);

        try {
            // Get signed upload URL
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.userToken}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get upload URL');
            }

            const { uploadUrl, publicUrl } = await response.json();

            // Upload file to Supabase Storage
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file');
            }

            // Update file item with success
            fileItem.classList.add('uploaded');
            fileItem.dataset.publicUrl = publicUrl;

            // Store uploaded file URLs for assignment submission
            if (!this.uploadedFiles) this.uploadedFiles = [];
            this.uploadedFiles.push(publicUrl);

        } catch (error) {
            console.error('File upload error:', error);
            fileItem.classList.add('error');
            fileItem.querySelector('.file-status').textContent = 'Upload failed';
        }
    }

    createFileItem(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item uploading';

        const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        const fileIcon = this.getFileIcon(file.type);

        fileItem.innerHTML = `
            <div class="file-info">
                <i class="${fileIcon} file-icon"></i>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${fileSize}</div>
                </div>
            </div>
            <div class="file-progress">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div class="file-status">Uploading...</div>
            </div>
            <button class="file-remove" title="Remove file">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Remove file functionality
        fileItem.querySelector('.file-remove').addEventListener('click', () => {
            const publicUrl = fileItem.dataset.publicUrl;
            if (publicUrl && this.uploadedFiles) {
                this.uploadedFiles = this.uploadedFiles.filter(url => url !== publicUrl);
            }
            fileItem.remove();
        });

        return fileItem;
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return 'fas fa-image';
        if (mimeType === 'application/pdf') return 'fas fa-file-pdf';
        if (mimeType.includes('zip')) return 'fas fa-file-archive';
        if (mimeType.startsWith('text/')) return 'fas fa-file-alt';
        return 'fas fa-file';
    }

    openAssignmentModal(weekNumber, taskDay, taskDescription, deliverable) {
        const modal = document.getElementById('assignment-modal');
        const title = document.getElementById('assignment-modal-title');
        const info = document.getElementById('assignment-info');

        title.textContent = `Submit Assignment - Week ${weekNumber}, ${taskDay}`;

        info.innerHTML = `
            <div class="assignment-info-content">
                <h4>Task: ${taskDescription}</h4>
                <p><strong>Deliverable:</strong> ${deliverable}</p>
            </div>
        `;

        // Reset form
        document.getElementById('assignment-form').reset();
        document.getElementById('file-list').innerHTML = '';
        this.uploadedFiles = [];
        document.getElementById('assignment-message').classList.add('hidden');

        modal.classList.add('show');
    }

    async submitAssignment() {
        if (!this.currentUser || !this.userToken) {
            alert('Please sign in to submit assignments');
            return;
        }

        const content = document.getElementById('assignment-content').value.trim();
        const externalLinks = [document.getElementById('assignment-links').value.trim()].filter(link => link);

        // Get assignment info from modal
        const modal = document.getElementById('assignment-modal');
        const title = modal.querySelector('#assignment-modal-title').textContent;
        const weekMatch = title.match(/Week (\d+)/);
        const dayMatch = title.match(/, (\w+)/);

        if (!weekMatch || !dayMatch) {
            this.showAssignmentMessage('Could not determine assignment details', 'error');
            return;
        }

        const weekNumber = parseInt(weekMatch[1]);
        const taskDay = dayMatch[1];

        if (!content && (!this.uploadedFiles || this.uploadedFiles.length === 0)) {
            this.showAssignmentMessage('Please provide content or upload files', 'error');
            return;
        }

        const submitBtn = document.getElementById('assignment-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const response = await fetch('/api/assignments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.userToken}`
                },
                body: JSON.stringify({
                    weekNumber,
                    taskDay,
                    title: `Week ${weekNumber} - ${taskDay} Assignment`,
                    description: modal.querySelector('.assignment-info-content h4').textContent,
                    submissionType: content ? 'text' : 'file',
                    content: content || null,
                    fileUrls: this.uploadedFiles || [],
                    externalLinks
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAssignmentMessage('Assignment submitted successfully!', 'success');

                // Update progress if task was completed
                await this.updateProgress(weekNumber, taskDay, true);

                setTimeout(() => {
                    this.closeModals();
                    this.renderCurriculum();
                }, 1500);
            } else {
                this.showAssignmentMessage(data.error || 'Failed to submit assignment', 'error');
            }
        } catch (error) {
            console.error('Assignment submission error:', error);
            this.showAssignmentMessage('Network error. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Assignment';
        }
    }

    async updateProgress(weekNumber, taskDay, completed) {
        if (!this.currentUser || !this.userToken) return;

        try {
            await fetch('/api/progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.userToken}`
                },
                body: JSON.stringify({
                    weekNumber,
                    taskDay,
                    completed
                })
            });
        } catch (error) {
            console.error('Progress update error:', error);
        }
    }

    showAssignmentMessage(message, type) {
        const messageEl = document.getElementById('assignment-message');
        messageEl.textContent = message;
        messageEl.className = `assignment-message ${type}`;
        messageEl.classList.remove('hidden');
    }

    async renderMyWork() {
        const container = document.getElementById('mywork-content');
        if (!container) return;

        // Clear any existing error states
        container.innerHTML = '';

        if (!this.currentUser) {
            this.hideTabLoading('mywork');
            container.innerHTML = `
                <div class="mywork-signin-prompt">
                    <h3>Please sign in to view your work</h3>
                    <p>Access your submitted assignments and reflections.</p>
                    <button onclick="document.getElementById('auth-btn').click()" class="signin-btn">
                        Sign In to View Work
                    </button>
                </div>
            `;
            return;
        }

        try {
            // Fetch assignments with timeout
            const assignmentsPromise = fetch('/api/assignments', {
                headers: { 'Authorization': `Bearer ${this.userToken}` },
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            const assignmentsResult = await Promise.resolve(
                assignmentsPromise.then(async (response) => ({
                    success: response.ok,
                    data: response.ok ? await response.json() : { assignments: [] }
                })).catch(error => {
                    if (error.name === 'TimeoutError') {
                        throw new Error('Request timed out');
                    }
                    throw error;
                })
            );

            const { assignments } = assignmentsResult.data;

            // Create work sections with optimized DOM
            const workSections = document.createElement('div');
            workSections.className = 'work-sections';

            // Separate assignments and reflections
            const regularAssignments = assignments.filter(a => a.submission_type !== 'reflection');
            const reflections = assignments.filter(a => a.submission_type === 'reflection');

            // Assignments section
            const assignmentsSection = document.createElement('div');
            assignmentsSection.className = 'work-section';
            assignmentsSection.innerHTML = `
                <h3>Submitted Assignments (${regularAssignments.length})</h3>
                ${regularAssignments.length > 0 ?
                    regularAssignments.map(assignment => this.generateAssignmentCard(assignment)).join('') :
                    '<p class="no-work">No assignments submitted yet.</p>'
                }
            `;

            // Reflections section
            const reflectionsSection = document.createElement('div');
            reflectionsSection.className = 'work-section';
            reflectionsSection.innerHTML = `
                <h3>Week Reflections (${reflections.length})</h3>
                ${reflections.length > 0 ?
                    reflections.map(reflection => this.generateReflectionCard(reflection)).join('') :
                    '<p class="no-work">No reflections submitted yet.</p>'
                }
            `;

            workSections.appendChild(assignmentsSection);
            workSections.appendChild(reflectionsSection);

            // Hide loading and update content
            this.hideTabLoading('mywork');
            container.appendChild(workSections);

        } catch (error) {
            console.error('My work loading error:', error);
            this.hideTabLoading('mywork');

            const errorMessage = error.message === 'Request timed out'
                ? 'Request timed out. Please check your connection.'
                : 'Failed to load work data. Please try again.';

            container.innerHTML = `
                <div class="mywork-error">
                    <i class="fas fa-exclamation-triangle error-icon"></i>
                    <h3>Failed to load your work</h3>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="window.curriculumPlanner.switchTab('mywork')">
                        <i class="fas fa-redo"></i>
                        Try Again
                    </button>
                </div>
            `;
            throw error; // Re-throw so the timeout handler catches it
        }
    }

    generateMyWorkHTML(assignments) {
        // Separate assignments and reflections (we'll add reflections later)
        const regularAssignments = assignments.filter(a => a.submission_type !== 'reflection');
        const reflections = assignments.filter(a => a.submission_type === 'reflection');

        return `
            <div class="work-sections">
                <div class="work-section">
                    <h3>Submitted Assignments (${regularAssignments.length})</h3>
                    ${regularAssignments.length > 0 ?
                        regularAssignments.map(assignment => this.generateAssignmentCard(assignment)).join('') :
                        '<p class="no-work">No assignments submitted yet.</p>'
                    }
                </div>

                <div class="work-section">
                    <h3>Week Reflections (${reflections.length})</h3>
                    ${reflections.length > 0 ?
                        reflections.map(reflection => this.generateReflectionCard(reflection)).join('') :
                        '<p class="no-work">No reflections submitted yet.</p>'
                    }
                </div>
            </div>
        `;
    }

    generateAssignmentCard(assignment) {
        const submittedDate = new Date(assignment.submitted_at).toLocaleDateString();
        const statusClass = `status-${assignment.status}`;
        const statusText = assignment.status.replace('_', ' ');

        return `
            <div class="work-card assignment-card">
                <div class="work-header">
                    <div class="work-title">${assignment.title}</div>
                    <div class="work-meta">
                        <span class="work-week">Week ${assignment.week_number}</span>
                        <span class="work-date">${submittedDate}</span>
                        <span class="work-status ${statusClass}">${statusText}</span>
                    </div>
                </div>
                <div class="work-content">
                    <div class="work-description">${assignment.description}</div>
                    ${assignment.content ? `<div class="work-preview">${assignment.content.substring(0, 200)}${assignment.content.length > 200 ? '...' : ''}</div>` : ''}
                    ${assignment.file_urls && assignment.file_urls.length > 0 ?
                        `<div class="work-files">📎 ${assignment.file_urls.length} file(s) attached</div>` : ''
                    }
                </div>
                <div class="work-actions">
                    <button class="work-btn view-btn" data-assignment-id="${assignment.id}">
                        View Details
                    </button>
                    <button class="work-btn edit-btn" data-assignment-id="${assignment.id}">
                        Edit & Resubmit
                    </button>
                </div>
            </div>
        `;
    }

    generateReflectionCard(reflection) {
        const submittedDate = new Date(reflection.submitted_at).toLocaleDateString();

        return `
            <div class="work-card reflection-card">
                <div class="work-header">
                    <div class="work-title">Week ${reflection.week_number} Reflections</div>
                    <div class="work-meta">
                        <span class="work-date">${submittedDate}</span>
                    </div>
                </div>
                <div class="work-content">
                    <div class="work-description">Reflection answers for Week ${reflection.week_number}</div>
                </div>
                <div class="work-actions">
                    <button class="work-btn view-btn" data-reflection-id="${reflection.id}">
                        View Reflections
                    </button>
                    <button class="work-btn edit-btn" data-reflection-id="${reflection.id}">
                        Edit Reflections
                    </button>
                </div>
            </div>
        `;
    }

    openReflectionModal(weekNumber) {
        const modal = document.getElementById('reflection-modal');
        const title = document.getElementById('reflection-modal-title');
        const info = document.getElementById('reflection-info');
        const questions = document.getElementById('reflection-questions');

        title.textContent = `Week ${weekNumber} Reflections`;

        // Get the week data
        const week = this.curriculum.weeks.find(w => w.week_number === weekNumber);
        if (!week) return;

        info.innerHTML = `
            <div class="reflection-info-content">
                <h4>${week.title}</h4>
                <p>Reflect on your learning this week and answer the questions below.</p>
            </div>
        `;

        // Load existing reflections or create empty form
        const reflectionAnswers = this.loadReflectionAnswers(weekNumber);

        questions.innerHTML = week.reflection_questions.map((question, index) => `
            <div class="reflection-question">
                <label class="question-label">${question}</label>
                <textarea
                    class="reflection-answer"
                    data-question-index="${index}"
                    placeholder="Write your reflection here..."
                    rows="4"
                >${reflectionAnswers[index] || ''}</textarea>
            </div>
        `).join('');

        // Add auto-save listeners
        questions.querySelectorAll('.reflection-answer').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                this.autoSaveReflection(weekNumber, e.target.dataset.questionIndex, e.target.value);
            });
        });

        modal.classList.add('show');
    }

    loadReflectionAnswers(weekNumber) {
        // Load from localStorage for now
        const key = `reflections_week_${weekNumber}`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : [];
    }

    autoSaveReflection(weekNumber, questionIndex, answer) {
        const key = `reflections_week_${weekNumber}`;
        const answers = this.loadReflectionAnswers(weekNumber);
        answers[questionIndex] = answer;
        localStorage.setItem(key, JSON.stringify(answers));
    }

    async saveReflections(isFinalSubmit = false) {
        const weekNumber = parseInt(document.getElementById('reflection-modal-title').textContent.match(/Week (\d+)/)[1]);
        const answers = [];

        document.querySelectorAll('.reflection-answer').forEach((textarea, index) => {
            answers[index] = textarea.value.trim();
        });

        // Check if all questions are answered for final submit
        if (isFinalSubmit && answers.some(answer => !answer)) {
            this.showReflectionMessage('Please answer all reflection questions before submitting.', 'error');
            return;
        }

        const submitBtn = document.getElementById(isFinalSubmit ? 'reflection-submit-btn' : 'reflection-save-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = isFinalSubmit ? 'Submitting...' : 'Saving...';

        try {
            if (isFinalSubmit) {
                // Submit as assignment with type 'reflection'
                const week = this.curriculum.weeks.find(w => w.week_number === weekNumber);
                const reflectionContent = week.reflection_questions.map((question, index) =>
                    `Q: ${question}\nA: ${answers[index]}\n`
                ).join('\n');

                const response = await fetch('/api/assignments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.userToken}`
                    },
                    body: JSON.stringify({
                        weekNumber,
                        taskDay: 'Reflections',
                        title: `Week ${weekNumber} Reflections`,
                        description: `Reflection answers for ${week.title}`,
                        submissionType: 'reflection',
                        content: reflectionContent,
                        externalLinks: []
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    this.showReflectionMessage('Reflections submitted successfully!', 'success');
                    // Clear local storage
                    localStorage.removeItem(`reflections_week_${weekNumber}`);
                    setTimeout(() => {
                        this.closeModals();
                        this.renderCurriculum();
                    }, 1500);
                } else {
                    this.showReflectionMessage(data.error || 'Failed to submit reflections', 'error');
                }
            } else {
                // Just save progress locally (already auto-saved)
                this.showReflectionMessage('Progress saved!', 'success');
                setTimeout(() => {
                    document.getElementById('reflection-message').classList.add('hidden');
                }, 2000);
            }
        } catch (error) {
            console.error('Reflection submission error:', error);
            this.showReflectionMessage('Network error. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isFinalSubmit ? 'Submit Reflections' : 'Save Progress';
        }
    }

    showReflectionMessage(message, type) {
        const messageEl = document.getElementById('reflection-message');
        messageEl.textContent = message;
        messageEl.className = `reflection-message ${type}`;
        messageEl.classList.remove('hidden');
    }

    async renderAnalytics() {
        const container = document.getElementById('analytics-content');
        if (!container) return;

        // Clear any existing error states
        container.innerHTML = '';

        if (!this.currentUser) {
            this.hideTabLoading('analytics');
            container.innerHTML = `
                <div class="analytics-signin-prompt">
                    <h3>Please sign in to view analytics</h3>
                    <p>Track your learning progress and get personalized insights.</p>
                    <button onclick="document.getElementById('auth-btn').click()" class="signin-btn">
                        Sign In to View Analytics
                    </button>
                </div>
            `;
            return;
        }

        try {
            // Create AbortController for timeout management
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            // Use Promise.allSettled for better error handling and performance
            const [progressResult, assignmentsResult, portfolioResult] = await Promise.allSettled([
                fetch('/api/progress', {
                    headers: { 'Authorization': `Bearer ${this.userToken}` },
                    signal: controller.signal
                }),
                fetch('/api/assignments', {
                    headers: { 'Authorization': `Bearer ${this.userToken}` },
                    signal: controller.signal
                }),
                fetch('/api/portfolio', {
                    headers: { 'Authorization': `Bearer ${this.userToken}` },
                    signal: controller.signal
                })
            ]);

            clearTimeout(timeoutId);

            // Safely extract data with fallbacks
            const progressData = progressResult.status === 'fulfilled' && progressResult.value.ok
                ? await progressResult.value.json()
                : { progress: [], stats: {} };

            const assignmentsData = assignmentsResult.status === 'fulfilled' && assignmentsResult.value.ok
                ? await assignmentsResult.value.json()
                : { assignments: [] };

            const portfolioData = portfolioResult.status === 'fulfilled' && portfolioResult.value.ok
                ? await portfolioResult.value.json()
                : { portfolio: [] };

            // Generate analytics dashboard with optimized DOM manipulation
            const analyticsHTML = this.generateAnalyticsDashboard(progressData, assignmentsData, portfolioData);

            // Hide loading and update content
            this.hideTabLoading('analytics');
            container.innerHTML = analyticsHTML;

        } catch (error) {
            console.error('Analytics loading error:', error);
            this.hideTabLoading('analytics');

            const errorMessage = error.name === 'AbortError'
                ? 'Request timed out. Please check your connection.'
                : 'Failed to load analytics data. Please try again.';

            container.innerHTML = `
                <div class="analytics-error">
                    <i class="fas fa-exclamation-triangle error-icon"></i>
                    <h3>Failed to load analytics</h3>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="window.curriculumPlanner.switchTab('analytics')">
                        <i class="fas fa-redo"></i>
                        Try Again
                    </button>
                </div>
            `;
            throw error; // Re-throw so the timeout handler catches it
        }
    }

    generateAnalyticsDashboard(progressData, assignmentsData, portfolioData) {
        const { stats, progress } = progressData;
        const { assignments } = assignmentsData;
        const { portfolio } = portfolioData;

        // Calculate additional analytics
        const analytics = this.calculateAnalytics(progress, assignments, portfolio);

        return `
            <div class="analytics-overview">
                <div class="analytics-metrics">
                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value">${stats.overallProgress || 0}%</div>
                            <div class="metric-label">Overall Progress</div>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-tasks"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value">${stats.completedTasks || 0}/${stats.totalTasks || 60}</div>
                            <div class="metric-label">Tasks Completed</div>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-upload"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value">${assignments.length}</div>
                            <div class="metric-label">Assignments Submitted</div>
                        </div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-briefcase"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value">${portfolio.filter(p => p.status === 'completed').length}</div>
                            <div class="metric-label">Portfolio Items</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="analytics-charts">
                <div class="chart-section">
                    <h3>Weekly Progress Breakdown</h3>
                    <div class="weekly-progress-chart">
                        ${this.generateWeeklyProgressChart(progress)}
                    </div>
                </div>

                <div class="chart-section">
                    <h3>Learning Activity</h3>
                    <div class="activity-chart">
                        ${this.generateActivityChart(assignments)}
                    </div>
                </div>

                <div class="chart-section">
                    <h3>AI Feedback Summary</h3>
                    <div class="feedback-summary">
                        ${this.generateFeedbackSummary(assignments)}
                    </div>
                </div>
            </div>

            <div class="analytics-insights">
                <h3>Personalized Insights</h3>
                <div class="insights-grid">
                    ${this.generateInsights(analytics)}
                </div>
            </div>
        `;
    }

    calculateAnalytics(progress, assignments, portfolio) {
        const analytics = {
            weeklyCompletion: {},
            taskTypes: {},
            feedbackScores: [],
            consistency: 0,
            streak: 0
        };

        // Calculate weekly completion rates
        progress.forEach(p => {
            if (!analytics.weeklyCompletion[p.week_number]) {
                analytics.weeklyCompletion[p.week_number] = { completed: 0, total: 5 };
            }
            if (p.completed) {
                analytics.weeklyCompletion[p.week_number].completed++;
            }
        });

        // Analyze assignment types
        assignments.forEach(assignment => {
            const type = assignment.submission_type;
            analytics.taskTypes[type] = (analytics.taskTypes[type] || 0) + 1;

            // Collect AI feedback scores
            if (assignment.assignment_feedback) {
                assignment.assignment_feedback.forEach(feedback => {
                    if (feedback.feedback_type === 'ai_generated' && feedback.score) {
                        analytics.feedbackScores.push(feedback.score);
                    }
                });
            }
        });

        // Calculate consistency (how regular the progress is)
        const completedWeeks = Object.values(analytics.weeklyCompletion)
            .filter(week => week.completed === week.total).length;
        analytics.consistency = Math.round((completedWeeks / 12) * 100);

        return analytics;
    }

    generateWeeklyProgressChart(progress) {
        const weeklyData = {};
        progress.forEach(p => {
            if (!weeklyData[p.week_number]) {
                weeklyData[p.week_number] = { completed: 0, total: 5 };
            }
            if (p.completed) {
                weeklyData[p.week_number].completed++;
            }
        });

        let chartHTML = '<div class="weekly-bars">';
        for (let week = 1; week <= 12; week++) {
            const data = weeklyData[week] || { completed: 0, total: 5 };
            const percentage = Math.round((data.completed / data.total) * 100);

            chartHTML += `
                <div class="weekly-bar-item">
                    <div class="bar-container">
                        <div class="bar-fill" style="height: ${percentage}%"></div>
                    </div>
                    <div class="bar-label">W${week}</div>
                    <div class="bar-value">${data.completed}/5</div>
                </div>
            `;
        }
        chartHTML += '</div>';

        return chartHTML;
    }

    generateActivityChart(assignments) {
        // Group assignments by week
        const weeklyActivity = {};
        assignments.forEach(assignment => {
            const week = assignment.week_number;
            weeklyActivity[week] = (weeklyActivity[week] || 0) + 1;
        });

        let chartHTML = '<div class="activity-bars">';
        for (let week = 1; week <= 12; week++) {
            const count = weeklyActivity[week] || 0;

            chartHTML += `
                <div class="activity-bar-item">
                    <div class="activity-bar" style="height: ${Math.min(count * 20, 100)}px"></div>
                    <div class="activity-label">W${week}</div>
                    <div class="activity-value">${count}</div>
                </div>
            `;
        }
        chartHTML += '</div>';

        return chartHTML;
    }

    generateFeedbackSummary(assignments) {
        let totalFeedback = 0;
        let avgScore = 0;
        const scoreDistribution = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };

        assignments.forEach(assignment => {
            if (assignment.assignment_feedback) {
                assignment.assignment_feedback.forEach(feedback => {
                    if (feedback.feedback_type === 'ai_generated' && feedback.score) {
                        totalFeedback++;
                        avgScore += feedback.score;
                        const roundedScore = Math.floor(feedback.score / 2) * 2; // Round to nearest even number
                        if (scoreDistribution[roundedScore] !== undefined) {
                            scoreDistribution[roundedScore]++;
                        }
                    }
                });
            }
        });

        if (totalFeedback === 0) {
            return '<p class="no-feedback">No AI feedback yet. Complete assignments to receive automated feedback!</p>';
        }

        avgScore = Math.round((avgScore / totalFeedback) * 10) / 10;

        return `
            <div class="feedback-stats">
                <div class="feedback-metric">
                    <div class="feedback-score">${avgScore}</div>
                    <div class="feedback-label">Average Score</div>
                </div>
                <div class="feedback-metric">
                    <div class="feedback-count">${totalFeedback}</div>
                    <div class="feedback-label">Reviews Received</div>
                </div>
            </div>
            <div class="score-distribution">
                <h4>Score Distribution</h4>
                <div class="distribution-bars">
                    ${Object.entries(scoreDistribution).map(([score, count]) => `
                        <div class="distribution-item">
                            <div class="distribution-label">${score}</div>
                            <div class="distribution-bar">
                                <div class="distribution-fill" style="width: ${totalFeedback > 0 ? (count / totalFeedback) * 100 : 0}%"></div>
                            </div>
                            <div class="distribution-count">${count}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    generateInsights(analytics) {
        const insights = [];

        // Progress insights
        if (analytics.consistency > 80) {
            insights.push({
                type: 'success',
                icon: 'fas fa-fire',
                title: 'Consistency Champion!',
                description: 'You\'re maintaining excellent consistency in your learning schedule.'
            });
        } else if (analytics.consistency < 50) {
            insights.push({
                type: 'warning',
                icon: 'fas fa-clock',
                title: 'Consider Your Pace',
                description: 'Try to maintain a more consistent learning schedule for better results.'
            });
        }

        // Assignment insights
        const textAssignments = analytics.taskTypes.text || 0;
        const fileAssignments = (analytics.taskTypes.file || 0) + (analytics.taskTypes.image || 0);
        if (textAssignments > fileAssignments * 2) {
            insights.push({
                type: 'info',
                icon: 'fas fa-lightbulb',
                title: 'Try Visual Work',
                description: 'Consider submitting more visual assignments to build your portfolio.'
            });
        }

        // Feedback insights
        if (analytics.feedbackScores.length > 0) {
            const avgScore = analytics.feedbackScores.reduce((a, b) => a + b, 0) / analytics.feedbackScores.length;
            if (avgScore >= 8) {
                insights.push({
                    type: 'success',
                    icon: 'fas fa-star',
                    title: 'Excellent Work!',
                    description: 'Your assignments are receiving high scores. Keep up the great work!'
                });
            } else if (avgScore < 7) {
                insights.push({
                    type: 'info',
                    icon: 'fas fa-graduation-cap',
                    title: 'Growth Opportunity',
                    description: 'Review your AI feedback to identify areas for improvement.'
                });
            }
        }

        // Default insights if none generated
        if (insights.length === 0) {
            insights.push({
                type: 'info',
                icon: 'fas fa-chart-line',
                title: 'Keep Learning!',
                description: 'Continue working through the curriculum to unlock more detailed insights.'
            });
        }

        return insights.map(insight => `
            <div class="insight-card ${insight.type}">
                <div class="insight-icon">
                    <i class="${insight.icon}"></i>
                </div>
                <div class="insight-content">
                    <h4>${insight.title}</h4>
                    <p>${insight.description}</p>
                </div>
            </div>
        `).join('');
    }

    createWeekCard(week) {
        const card = document.createElement('div');
        card.className = 'week-card';
        card.dataset.weekNumber = week.week_number;

        const totalTasks = week.daily_tasks.length;
        const completedTasks = week.daily_tasks.filter(task =>
            this.completedTasks.has(`${week.week_number}-${task.day}`)
        ).length;
        const isCompleted = completedTasks === totalTasks;

        card.innerHTML = `
            <div class="week-header">
                <div class="week-title">
                    <span class="week-number">WEEK ${week.week_number}</span>
                    <div class="week-title-text">
                        <h3>${week.title}</h3>
                    </div>
                </div>
                <div class="week-objective">${week.objective}</div>
                <div class="week-meta">
                    <span class="week-progress">${completedTasks}/${totalTasks} tasks</span>
                    ${isCompleted ? `<button class="reflection-btn" data-week="${week.week_number}">Reflections</button>` : ''}
                    <i class="fas fa-chevron-down week-toggle"></i>
                </div>
            </div>
            <div class="week-content">
                <div class="week-body">
                    ${this.createDailyTasksHTML(week)}
                    ${this.createPortfolioMilestonesHTML(week)}
                    ${this.createReflectionQuestionsHTML(week)}
                </div>
            </div>
        `;

        // Add event listeners
        const header = card.querySelector('.week-header');
        const content = card.querySelector('.week-content');
        const toggle = card.querySelector('.week-toggle');

        const toggleWeek = () => {
            content.classList.toggle('expanded');
            toggle.classList.toggle('rotated');
        };

        header.addEventListener('click', (e) => {
            // Don't toggle if clicking directly on the toggle button (it has its own handler)
            if (!e.target.closest('.week-toggle')) {
                toggleWeek();
            }
        });

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleWeek();
        });

        // Add task checkbox listeners
        card.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTask(week.week_number, e.target.dataset.day);
            });
        });

        // Add submit assignment listeners
        card.querySelectorAll('.submit-assignment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const { week, day, description, deliverable } = btn.dataset;
                this.openAssignmentModal(parseInt(week), day, description, deliverable);
            });
        });

        // Add reflection listeners
        card.querySelectorAll('.reflection-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const weekNumber = parseInt(btn.dataset.week);
                this.openReflectionModal(weekNumber);
            });
        });

        return card;
    }

    createDailyTasksHTML(week) {
        return `
            <div class="daily-tasks">
                <h4 class="section-header">
                    <i class="fas fa-tasks section-icon"></i>
                    Daily Tasks
                </h4>
                <div class="task-list">
                    ${week.daily_tasks.map(task => {
                        const taskId = `${week.week_number}-${task.day}`;
                        const isCompleted = this.completedTasks.has(taskId);

                        return `
                            <div class="task-item ${isCompleted ? 'completed' : ''}">
                                <div class="task-header">
                                    <span class="task-day">${task.day}</span>
                                    <div class="task-checkbox ${isCompleted ? 'checked' : ''}" data-day="${task.day}"></div>
                                </div>
                                <div class="task-description">${task.description}</div>
                                <a href="${task.resource_link}" target="_blank" class="task-resource">
                                    <i class="fas fa-external-link-alt"></i>
                                    Resource Link
                                </a>
                                <div class="task-deliverable">
                                    <strong>Deliverable:</strong> ${task.deliverable}
                                </div>
                                <div class="task-actions">
                                    <button class="submit-assignment-btn" data-week="${week.week_number}" data-day="${task.day}" data-description="${task.description}" data-deliverable="${task.deliverable}">
                                        <i class="fas fa-upload"></i>
                                        Submit Assignment
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    createPortfolioMilestonesHTML(week) {
        if (!week.portfolio_milestones || week.portfolio_milestones.length === 0) {
            return '';
        }

        return `
            <div class="portfolio-milestones">
                <h4 class="section-header">
                    <i class="fas fa-trophy section-icon"></i>
                    Portfolio Milestones
                </h4>
                ${week.portfolio_milestones.map(milestone => `
                    <div class="milestone-item">
                        <div class="milestone-header">
                            <i class="fas fa-star milestone-icon"></i>
                            <span class="milestone-title">${milestone.title}</span>
                        </div>
                        <p class="milestone-description">${milestone.description}</p>
                        <div class="milestone-deliverables">
                            ${milestone.deliverables.map(deliverable => `
                                <span class="deliverable-tag">${deliverable}</span>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    createReflectionQuestionsHTML(week) {
        if (!week.reflection_questions || week.reflection_questions.length === 0) {
            return '';
        }

        return `
            <div class="reflection-questions">
                <h4 class="section-header">
                    <i class="fas fa-brain section-icon"></i>
                    Reflection Questions
                </h4>
                <div class="question-list">
                    ${week.reflection_questions.map(question => `
                        <div class="question-item">
                            <p class="question-text">${question}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateAuthUI() {
        const authBtn = document.getElementById('auth-btn');
        const userMenu = document.getElementById('user-menu');
        const userInfo = document.getElementById('user-info');

        if (this.currentUser) {
            authBtn.innerHTML = `
                <i class="fas fa-user-circle"></i>
                <span>${this.currentUser.profile?.full_name || this.currentUser.email}</span>
            `;
            authBtn.classList.add('authenticated');

            userInfo.innerHTML = `
                <div class="user-email">${this.currentUser.email}</div>
                <div class="user-name">${this.currentUser.profile?.full_name || 'User'}</div>
            `;
            userMenu.classList.remove('hidden');
        } else {
            authBtn.innerHTML = `
                <i class="fas fa-user"></i>
                <span>Sign In</span>
            `;
            authBtn.classList.remove('authenticated');
            userMenu.classList.add('hidden');
        }
    }

    toggleUserMenu() {
        const userMenu = document.getElementById('user-menu');
        userMenu.classList.toggle('hidden');
    }

    showAuthModal() {
        const modal = document.getElementById('auth-modal');
        modal.classList.add('show');
        this.resetAuthForm();
    }

    resetAuthForm() {
        document.getElementById('auth-form').reset();
        document.getElementById('auth-modal-title').textContent = 'Sign In';
        document.getElementById('auth-submit-btn').textContent = 'Sign In';
        document.getElementById('auth-toggle-text').textContent = "Don't have an account?";
        document.getElementById('auth-toggle-btn').textContent = 'Sign Up';
        document.getElementById('name-group').classList.add('hidden');
        document.getElementById('auth-message').classList.add('hidden');
    }

    toggleAuthMode() {
        const isSignUp = document.getElementById('auth-modal-title').textContent === 'Sign Up';

        if (isSignUp) {
            // Switch to sign in
            document.getElementById('auth-modal-title').textContent = 'Sign In';
            document.getElementById('auth-submit-btn').textContent = 'Sign In';
            document.getElementById('auth-toggle-text').textContent = "Don't have an account?";
            document.getElementById('auth-toggle-btn').textContent = 'Sign Up';
            document.getElementById('name-group').classList.add('hidden');
        } else {
            // Switch to sign up
            document.getElementById('auth-modal-title').textContent = 'Sign Up';
            document.getElementById('auth-submit-btn').textContent = 'Sign Up';
            document.getElementById('auth-toggle-text').textContent = 'Already have an account?';
            document.getElementById('auth-toggle-btn').textContent = 'Sign In';
            document.getElementById('name-group').classList.remove('hidden');
        }

        document.getElementById('auth-form').reset();
        document.getElementById('auth-message').classList.add('hidden');
    }

    async handleAuth() {
        const isSignUp = document.getElementById('auth-modal-title').textContent === 'Sign Up';
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const fullName = document.getElementById('fullName').value;

        const authMessage = document.getElementById('auth-message');
        const submitBtn = document.getElementById('auth-submit-btn');

        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.textContent = isSignUp ? 'Creating Account...' : 'Signing In...';

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: isSignUp ? 'signup' : 'signin',
                    email,
                    password,
                    ...(isSignUp && { fullName })
                })
            });

            const data = await response.json();

            if (response.ok) {
                if (isSignUp) {
                    authMessage.textContent = 'Account created successfully!';
                    authMessage.className = 'auth-message success';
                    // For signup, also log the user in immediately
                    this.userToken = data.session?.access_token || 'mock-token-' + data.user.id;
                    this.currentUser = data.user;
                    this.updateAuthUI();
                    this.closeModals();
                    this.updateStats();
                    this.renderCurriculum();
                } else {
                    this.userToken = data.session?.access_token || 'mock-token-' + data.user.id;
                    this.currentUser = data.user;
                    this.updateAuthUI();
                    this.closeModals();
                    await this.loadProgressFromDB();
                    this.updateStats();
                    this.renderCurriculum();
                }
                authMessage.classList.remove('hidden');
            } else {
                authMessage.textContent = data.error || 'Authentication failed';
                authMessage.className = 'auth-message error';
                authMessage.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Auth error:', error);
            // Check if API is not available - fallback to local mode
            if (error.message.includes('fetch') || error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                // Enable local mode for testing
                this.enableLocalMode();
                this.currentUser = {
                    id: 'local-user-' + Date.now(),
                    email: email,
                    profile: { full_name: fullName || email.split('@')[0] }
                };
                this.userToken = 'local-token';
                this.updateAuthUI();
                this.closeModals();
                this.updateStats();
                this.renderCurriculum();

                authMessage.textContent = 'Signed in successfully (local mode)';
                authMessage.className = 'auth-message success';
                authMessage.classList.remove('hidden');
            } else {
                authMessage.textContent = 'Network error. Please try again.';
                authMessage.className = 'auth-message error';
                authMessage.classList.remove('hidden');
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
        }
    }

    async signOut() {
        try {
            await fetch('/api/auth', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.userToken}`
                }
            });
        } catch (error) {
            console.error('Sign out error:', error);
        }

        this.currentUser = null;
        this.userToken = null;
        this.completedTasks.clear();
        this.updateAuthUI();
        this.loadProgress(); // Load from localStorage
        this.updateStats();
        this.renderCurriculum();
    }

    toggleTask(weekNumber, day) {
        const taskId = `${weekNumber}-${day}`;
        if (this.completedTasks.has(taskId)) {
            this.completedTasks.delete(taskId);
        } else {
            this.completedTasks.add(taskId);
        }
        this.saveProgress();
        this.updateStats();
        this.updateWeekCard(weekNumber);
    }

    updateWeekCard(weekNumber) {
        const card = document.querySelector(`[data-week-number="${weekNumber}"]`);
        if (!card) return;

        const week = this.curriculum.weeks.find(w => w.week_number === weekNumber);
        const totalTasks = week.daily_tasks.length;
        const completedTasks = week.daily_tasks.filter(task =>
            this.completedTasks.has(`${weekNumber}-${task.day}`)
        ).length;

        const progressElement = card.querySelector('.week-progress');
        progressElement.textContent = `${completedTasks}/${totalTasks} tasks`;

        // Update checkboxes
        card.querySelectorAll('.task-checkbox').forEach(checkbox => {
            const taskId = `${weekNumber}-${checkbox.dataset.day}`;
            const isCompleted = this.completedTasks.has(taskId);
            checkbox.classList.toggle('checked', isCompleted);
            checkbox.closest('.task-item').classList.toggle('completed', isCompleted);
        });
    }

    updateStats() {
        const totalTasks = this.curriculum.weeks.reduce((sum, week) => sum + week.daily_tasks.length, 0);
        const completedTasks = this.completedTasks.size;
        const completedWeeks = this.curriculum.weeks.filter(week => {
            const weekTasks = week.daily_tasks.length;
            const weekCompleted = week.daily_tasks.filter(task =>
                this.completedTasks.has(`${week.week_number}-${task.day}`)
            ).length;
            return weekCompleted === weekTasks;
        }).length;

        document.getElementById('completed-weeks').textContent = completedWeeks;
        document.getElementById('total-tasks').textContent = totalTasks;
        document.getElementById('completed-tasks').textContent = completedTasks;
    }

    showProgressModal() {
        const modal = document.getElementById('progress-modal');
        const overallProgress = document.getElementById('overall-progress');
        const progressWeeks = document.getElementById('progress-weeks');
        const progressTasks = document.getElementById('progress-tasks');
        const progressPortfolio = document.getElementById('progress-portfolio');
        const weeklyBars = document.getElementById('weekly-progress-bars');

        // Calculate stats
        const totalTasks = this.curriculum.weeks.reduce((sum, week) => sum + week.daily_tasks.length, 0);
        const completedTasks = this.completedTasks.size;
        const completedWeeks = this.curriculum.weeks.filter(week => {
            const weekTasks = week.daily_tasks.length;
            const weekCompleted = week.daily_tasks.filter(task =>
                this.completedTasks.has(`${week.week_number}-${task.day}`)
            ).length;
            return weekCompleted === weekTasks;
        }).length;

        const portfolioMilestones = this.curriculum.weeks.reduce((sum, week) =>
            sum + (week.portfolio_milestones ? week.portfolio_milestones.length : 0), 0
        );
        const completedPortfolio = this.curriculum.weeks.filter(week =>
            week.portfolio_milestones && week.portfolio_milestones.length > 0 &&
            week.daily_tasks.every(task => this.completedTasks.has(`${week.week_number}-${task.day}`))
        ).length;

        // Update progress circle
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        overallProgress.textContent = `${percentage}%`;

        const circle = document.querySelector('.progress-ring-circle');
        const circumference = 2 * Math.PI * 50;
        const offset = circumference - (percentage / 100) * circumference;
        circle.style.strokeDashoffset = offset;

        // Update details
        progressWeeks.textContent = `${completedWeeks}/12`;
        progressTasks.textContent = `${completedTasks}/${totalTasks}`;
        progressPortfolio.textContent = `${completedPortfolio}/${portfolioMilestones}`;

        // Update weekly progress bars
        weeklyBars.innerHTML = this.curriculum.weeks.map(week => {
            const weekTasks = week.daily_tasks.length;
            const weekCompleted = week.daily_tasks.filter(task =>
                this.completedTasks.has(`${week.week_number}-${task.day}`)
            ).length;
            const weekPercentage = weekTasks > 0 ? Math.round((weekCompleted / weekTasks) * 100) : 0;

            return `
                <div class="progress-week">
                    <span class="progress-week-label">Week ${week.week_number}</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${weekPercentage}%"></div>
                    </div>
                    <span class="progress-week-percent">${weekPercentage}%</span>
                </div>
            `;
        }).join('');

        modal.classList.add('show');
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="background: var(--error-color); color: white; padding: 1rem; border-radius: var(--border-radius); margin: 1rem 0;">
                <i class="fas fa-exclamation-triangle"></i>
                ${message}
            </div>
        `;
        document.querySelector('.main-content').prepend(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CurriculumPlanner();
});
