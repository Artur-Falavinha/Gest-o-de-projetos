// Global application state
const AppState = {
    currentUser: null,
    currentProject: null,
    projects: [],
    activities: [],
    users: [],
    draggedActivity: null
};

// API utility functions
const API = {
    // Base request function
    async request(endpoint, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(AppState.currentUser && { 'user-id': AppState.currentUser.id })
            },
            ...options
        };

        try {
            const response = await fetch(`/api${endpoint}`, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erro na requisição');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Authentication
    async login(username, password) {
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },

    // Users
    async getUsers() {
        return this.request('/users');
    },

    // Projects
    async getProjects() {
        return this.request('/projects');
    },

    async createProject(projectData) {
        return this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(projectData)
        });
    },

    async updateProject(id, projectData) {
        return this.request(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(projectData)
        });
    },

    async deleteProject(id) {
        return this.request(`/projects/${id}`, {
            method: 'DELETE'
        });
    },

    async updateProjectColumns(id, columns) {
        return this.request(`/projects/${id}/columns`, {
            method: 'PUT',
            body: JSON.stringify({ columns })
        });
    },

    // Activities
    async getActivities(projectId) {
        return this.request(`/projects/${projectId}/activities`);
    },

    async createActivity(projectId, activityData) {
        return this.request(`/projects/${projectId}/activities`, {
            method: 'POST',
            body: JSON.stringify(activityData)
        });
    },

    async updateActivity(id, activityData) {
        return this.request(`/activities/${id}`, {
            method: 'PUT',
            body: JSON.stringify(activityData)
        });
    },

    async deleteActivity(id) {
        return this.request(`/activities/${id}`, {
            method: 'DELETE'
        });
    },

    async toggleDevelopment(id) {
        return this.request(`/activities/${id}/development`, {
            method: 'PUT'
        });
    }
};

// UI utility functions
const UI = {
    // Show/hide loading
    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    },

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    },

    // Screen management
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    },

    // Modal management
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    // Error handling
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.classList.add('show');
        setTimeout(() => {
            errorElement.classList.remove('show');
        }, 5000);
    },

    // Success messages
    showSuccess(message) {
        // Create success notification
        const notification = document.createElement('div');
        notification.className = 'success-message show';
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    },

    // Clear form
    clearForm(formId) {
        document.getElementById(formId).reset();
    }
};

// Authentication functions
const Auth = {
    async login(username, password) {
        try {
            UI.showLoading();
            const result = await API.login(username, password);
            
            if (result.success) {
                AppState.currentUser = result.user;
                localStorage.setItem('currentUser', JSON.stringify(result.user));
                UI.showScreen('dashboard-screen');
                await Dashboard.load();
            }
        } catch (error) {
            UI.showError('login-error', error.message);
        } finally {
            UI.hideLoading();
        }
    },

    logout() {
        AppState.currentUser = null;
        localStorage.removeItem('currentUser');
        UI.showScreen('login-screen');
        UI.clearForm('login-form');
    },

    // Check if user is logged in on page load
    checkAuth() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            AppState.currentUser = JSON.parse(savedUser);
            UI.showScreen('dashboard-screen');
            Dashboard.load();
        } else {
            UI.showScreen('login-screen');
        }
        UI.hideLoading();
    }
};

// Dashboard functions
const Dashboard = {
    async load() {
        try {
            UI.showLoading();
            
            // Update user info
            document.getElementById('user-name').textContent = AppState.currentUser.name;
            
            // Load projects and users
            [AppState.projects, AppState.users] = await Promise.all([
                API.getProjects(),
                API.getUsers()
            ]);
            
            this.render();
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
        } finally {
            UI.hideLoading();
        }
    },

    render() {
        const grid = document.getElementById('projects-grid');
        
        if (AppState.projects.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #666;">
                    <h3>Nenhum projeto encontrado</h3>
                    <p>Comece criando seu primeiro projeto!</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = AppState.projects.map(project => `
            <div class="project-card" onclick="ProjectKanban.load('${project.id}')">
                <h3>${project.name}</h3>
                <p>${project.description || 'Sem descrição'}</p>
                <span class="project-status ${project.status.toLowerCase().replace('ã', 'a').replace('í', 'i')}">${project.status}</span>
                <div class="project-actions-card">
                    <button class="btn btn-outline btn-small" onclick="event.stopPropagation(); Project.edit('${project.id}')">Editar</button>
                    <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); Project.delete('${project.id}')">Excluir</button>
                </div>
            </div>
        `).join('');
    }
};

// Project management functions
const Project = {
    currentEditingId: null,

    create() {
        this.currentEditingId = null;
        document.getElementById('project-modal-title').textContent = 'Novo Projeto';
        UI.clearForm('project-form');
        UI.showModal('project-modal');
    },

    edit(id) {
        const project = AppState.projects.find(p => p.id === id);
        if (!project) return;

        this.currentEditingId = id;
        document.getElementById('project-modal-title').textContent = 'Editar Projeto';
        document.getElementById('project-name').value = project.name;
        document.getElementById('project-description').value = project.description || '';
        document.getElementById('project-status').value = project.status;
        UI.showModal('project-modal');
    },

    async save(formData) {
        try {
            UI.showLoading();
            
            if (this.currentEditingId) {
                await API.updateProject(this.currentEditingId, formData);
                UI.showSuccess('Projeto atualizado com sucesso!');
            } else {
                await API.createProject(formData);
                UI.showSuccess('Projeto criado com sucesso!');
            }
            
            UI.hideModal('project-modal');
            UI.clearForm('project-form');
            await Dashboard.load();
        } catch (error) {
            console.error('Erro ao salvar projeto:', error);
            alert('Erro ao salvar projeto: ' + error.message);
        } finally {
            UI.hideLoading();
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            UI.showLoading();
            await API.deleteProject(id);
            UI.showSuccess('Projeto excluído com sucesso!');
            await Dashboard.load();
        } catch (error) {
            console.error('Erro ao excluir projeto:', error);
            alert('Erro ao excluir projeto: ' + error.message);
        } finally {
            UI.hideLoading();
        }
    }
};

// Kanban board functions
const ProjectKanban = {
    async load(projectId) {
        try {
            UI.showLoading();
            
            const project = AppState.projects.find(p => p.id === projectId);
            if (!project) {
                alert('Projeto não encontrado');
                return;
            }
            
            AppState.currentProject = project;
            AppState.activities = await API.getActivities(projectId);
            
            document.getElementById('project-title').textContent = project.name;
            UI.showScreen('kanban-screen');
            this.render();
        } catch (error) {
            console.error('Erro ao carregar projeto:', error);
        } finally {
            UI.hideLoading();
        }
    },

    render() {
        const board = document.getElementById('kanban-board');
        const columns = AppState.currentProject.columns || [];
        
        board.innerHTML = columns.map(column => {
            const columnActivities = AppState.activities.filter(a => a.column === column.id);
            
            return `
                <div class="kanban-column" data-column="${column.id}">
                    <div class="column-header">
                        <h3>${column.name}</h3>
                        <span class="activity-count">${columnActivities.length}</span>
                    </div>
                    <div class="activities-list" data-column="${column.id}">
                        ${columnActivities.map(activity => this.renderActivity(activity)).join('')}
                    </div>
                </div>
            `;
        }).join('');
        
        this.setupDragAndDrop();
    },

    renderActivity(activity) {
        const user = AppState.users.find(u => u.id === activity.developmentBy);
        
        return `
            <div class="activity-card ${activity.inDevelopment ? 'in-development' : ''}" 
                 data-activity="${activity.id}" 
                 draggable="true">
                <h4>${activity.title}</h4>
                <p>${activity.description || 'Sem descrição'}</p>
                ${activity.inDevelopment ? `<div class="development-indicator">Em desenvolvimento por ${user ? user.name : 'Usuário'}</div>` : ''}
                <div class="activity-status">
                    <div class="activity-actions">
                        <button class="btn btn-small ${activity.inDevelopment && activity.developmentBy === AppState.currentUser.id ? 'btn-danger' : 'btn-success'}" 
                                onclick="Activity.toggleDevelopment('${activity.id}')">
                            ${activity.inDevelopment && activity.developmentBy === AppState.currentUser.id ? 'Parar' : 'Iniciar'}
                        </button>
                        <button class="btn btn-outline btn-small" onclick="Activity.edit('${activity.id}')">Editar</button>
                        <button class="btn btn-danger btn-small" onclick="Activity.delete('${activity.id}')">Excluir</button>
                    </div>
                </div>
            </div>
        `;
    },

    setupDragAndDrop() {
        // Setup drag events for activity cards
        document.querySelectorAll('.activity-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                AppState.draggedActivity = e.target.dataset.activity;
                e.target.classList.add('dragging');
            });

            card.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                AppState.draggedActivity = null;
            });
        });

        // Setup drop events for columns
        document.querySelectorAll('.activities-list').forEach(list => {
            list.addEventListener('dragover', (e) => {
                e.preventDefault();
                list.parentElement.classList.add('drag-over');
            });

            list.addEventListener('dragleave', (e) => {
                if (!list.contains(e.relatedTarget)) {
                    list.parentElement.classList.remove('drag-over');
                }
            });

            list.addEventListener('drop', async (e) => {
                e.preventDefault();
                list.parentElement.classList.remove('drag-over');
                
                if (AppState.draggedActivity) {
                    const newColumn = list.dataset.column;
                    await Activity.moveToColumn(AppState.draggedActivity, newColumn);
                }
            });
        });
    }
};

// Activity management functions
const Activity = {
    currentEditingId: null,

    create() {
        this.currentEditingId = null;
        document.getElementById('activity-modal-title').textContent = 'Nova Atividade';
        UI.clearForm('activity-form');
        
        // Populate column options
        const columnSelect = document.getElementById('activity-column');
        columnSelect.innerHTML = AppState.currentProject.columns.map(col => 
            `<option value="${col.id}">${col.name}</option>`
        ).join('');
        
        UI.showModal('activity-modal');
    },

    edit(id) {
        const activity = AppState.activities.find(a => a.id === id);
        if (!activity) return;

        this.currentEditingId = id;
        document.getElementById('activity-modal-title').textContent = 'Editar Atividade';
        document.getElementById('activity-title').value = activity.title;
        document.getElementById('activity-description').value = activity.description || '';
        
        // Populate column options
        const columnSelect = document.getElementById('activity-column');
        columnSelect.innerHTML = AppState.currentProject.columns.map(col => 
            `<option value="${col.id}" ${col.id === activity.column ? 'selected' : ''}>${col.name}</option>`
        ).join('');
        
        UI.showModal('activity-modal');
    },

    async save(formData) {
        try {
            UI.showLoading();
            
            if (this.currentEditingId) {
                await API.updateActivity(this.currentEditingId, formData);
                UI.showSuccess('Atividade atualizada com sucesso!');
            } else {
                await API.createActivity(AppState.currentProject.id, formData);
                UI.showSuccess('Atividade criada com sucesso!');
            }
            
            UI.hideModal('activity-modal');
            UI.clearForm('activity-form');
            await ProjectKanban.load(AppState.currentProject.id);
        } catch (error) {
            console.error('Erro ao salvar atividade:', error);
            alert('Erro ao salvar atividade: ' + error.message);
        } finally {
            UI.hideLoading();
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir esta atividade?')) {
            return;
        }

        try {
            UI.showLoading();
            await API.deleteActivity(id);
            UI.showSuccess('Atividade excluída com sucesso!');
            await ProjectKanban.load(AppState.currentProject.id);
        } catch (error) {
            console.error('Erro ao excluir atividade:', error);
            alert('Erro ao excluir atividade: ' + error.message);
        } finally {
            UI.hideLoading();
        }
    },

    async toggleDevelopment(id) {
        try {
            const activity = await API.toggleDevelopment(id);
            
            // Update local state
            const index = AppState.activities.findIndex(a => a.id === id);
            if (index !== -1) {
                AppState.activities[index] = activity;
            }
            
            ProjectKanban.render();
            
            UI.showSuccess(activity.inDevelopment ? 
                'Atividade marcada como em desenvolvimento' : 
                'Atividade desmarcada do desenvolvimento'
            );
        } catch (error) {
            console.error('Erro ao alterar status de desenvolvimento:', error);
            alert('Erro: ' + error.message);
        }
    },

    async moveToColumn(activityId, newColumn) {
        try {
            await API.updateActivity(activityId, { column: newColumn });
            
            // Update local state
            const activity = AppState.activities.find(a => a.id === activityId);
            if (activity) {
                activity.column = newColumn;
            }
            
            ProjectKanban.render();
            UI.showSuccess('Atividade movida com sucesso!');
        } catch (error) {
            console.error('Erro ao mover atividade:', error);
            ProjectKanban.render(); // Revert visual change
        }
    }
};

// Column management functions
const ColumnManager = {
    show() {
        this.render();
        UI.showModal('columns-modal');
    },

    render() {
        const list = document.getElementById('columns-list');
        list.innerHTML = AppState.currentProject.columns.map((column, index) => `
            <div class="column-item" data-column="${column.id}" data-index="${index}">
                <input type="text" value="${column.name}" data-field="name">
                <div class="column-controls">
                    <button class="btn btn-danger btn-small" onclick="ColumnManager.remove('${column.id}')">Remover</button>
                </div>
            </div>
        `).join('');
    },

    add() {
        const newColumn = {
            id: 'col_' + Date.now(),
            name: 'Nova Coluna',
            order: AppState.currentProject.columns.length
        };
        
        AppState.currentProject.columns.push(newColumn);
        this.render();
    },

    remove(columnId) {
        // Check if column has activities
        const hasActivities = AppState.activities.some(a => a.column === columnId);
        if (hasActivities) {
            alert('Não é possível remover uma coluna que possui atividades.');
            return;
        }

        // Don't allow removing if it's the last column
        if (AppState.currentProject.columns.length <= 1) {
            alert('Deve haver pelo menos uma coluna no projeto.');
            return;
        }
        AppState.currentProject.columns = AppState.currentProject.columns.filter(c => c.id !== columnId);
        
        // Update order of remaining columns
        AppState.currentProject.columns.forEach((col, index) => {
            col.order = index;
        });
        
        this.render();
    },

    async save() {
        try {
            UI.showLoading();
            
            // Get updated column names from inputs
            const columnItems = document.querySelectorAll('.column-item');
            const updatedColumns = [];
            
            columnItems.forEach(item => {
                const columnId = item.dataset.column;
                const newName = item.querySelector('input[data-field="name"]').value.trim();
                
                const column = AppState.currentProject.columns.find(c => c.id === columnId);
                if (column && newName) {
                    column.name = newName;
                    updatedColumns.push(column);
                }
            });
            
            // Update order based on current DOM order
            updatedColumns.forEach((col, index) => {
                col.order = index;
            });
            
            // Validate that we have at least one column
            if (updatedColumns.length === 0) {
                alert('Deve haver pelo menos uma coluna no projeto.');
                return;
            }
            
            // Update the project columns
            AppState.currentProject.columns = updatedColumns;
            
            await API.updateProjectColumns(AppState.currentProject.id, AppState.currentProject.columns);
            UI.hideModal('columns-modal');
            ProjectKanban.render();
            UI.showSuccess('Colunas atualizadas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar colunas:', error);
            alert('Erro ao salvar colunas: ' + error.message);
        } finally {
            UI.hideLoading();
        }
    }
};

// Event listeners setup
function setupEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        await Auth.login(formData.get('username'), formData.get('password'));
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', Auth.logout);

    // Navigation
    document.getElementById('back-to-dashboard').addEventListener('click', () => {
        UI.showScreen('dashboard-screen');
        Dashboard.load();
    });

    // Project actions
    document.getElementById('new-project-btn').addEventListener('click', Project.create);
    
    document.getElementById('project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        Project.save(Object.fromEntries(formData));
    });

    // Activity actions
    document.getElementById('new-activity-btn').addEventListener('click', Activity.create);
    
    document.getElementById('activity-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        Activity.save(Object.fromEntries(formData));
    });

    // Column management
    document.getElementById('manage-columns-btn').addEventListener('click', ColumnManager.show);
    document.getElementById('add-column-btn').addEventListener('click', ColumnManager.add);
    document.getElementById('save-columns-btn').addEventListener('click', ColumnManager.save);

    // Modal management
    document.querySelectorAll('.close-modal, .cancel-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.remove('active');
        });
    });

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    Auth.checkAuth();
});

// Handle page visibility change to refresh data
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && AppState.currentUser) {
        if (AppState.currentProject) {
            ProjectKanban.load(AppState.currentProject.id);
        } else {
            Dashboard.load();
        }
    }
});

// Handle connection errors
window.addEventListener('online', () => {
    UI.showSuccess('Conexão reestabelecida');
    if (AppState.currentUser) {
        if (AppState.currentProject) {
            ProjectKanban.load(AppState.currentProject.id);
        } else {
            Dashboard.load();
        }
    }
});

window.addEventListener('offline', () => {
    alert('Conexão perdida. Algumas funcionalidades podem não funcionar corretamente.');
});