const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database paths
const dbPath = path.join(__dirname, 'database');
const usersPath = path.join(dbPath, 'users.json');
const projectsPath = path.join(dbPath, 'projects.json');
const activitiesPath = path.join(dbPath, 'activities.json');

// Ensure database directory and files exist
function initializeDatabase() {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, JSON.stringify([
      {
        id: '1',
        username: 'admin',
        password: 'admin123',
        name: 'Administrador',
        email: 'admin@empresa.com'
      },
      {
        id: '2',
        username: 'user1',
        password: 'user123',
        name: 'João Silva',
        email: 'joao@empresa.com'
      },
      {
        id: '3',
        username: 'user2',
        password: 'user123',
        name: 'Maria Santos',
        email: 'maria@empresa.com'
      }
    ], null, 2));
  }

  if (!fs.existsSync(projectsPath)) {
    fs.writeFileSync(projectsPath, JSON.stringify([
      {
        id: '1',
        name: 'Sistema de Vendas',
        status: 'Desenvolvendo',
        description: 'Desenvolvimento do novo sistema de vendas',
        members: ['1', '2'],
        createdBy: '1',
        createdAt: new Date().toISOString(),
        columns: [
          { id: 'todo', name: 'A Fazer', order: 0 },
          { id: 'progress', name: 'Em Progresso', order: 1 },
          { id: 'done', name: 'Finalizado', order: 2 }
        ]
      }
    ], null, 2));
  }

  if (!fs.existsSync(activitiesPath)) {
    fs.writeFileSync(activitiesPath, JSON.stringify([
      {
        id: '1',
        projectId: '1',
        title: 'Criar tela de login',
        description: 'Desenvolver interface de autenticação',
        column: 'progress',
        assignedTo: '2',
        inDevelopment: true,
        developmentBy: '2',
        createdAt: new Date().toISOString(),
        order: 0
      },
      {
        id: '2',
        projectId: '1',
        title: 'Configurar banco de dados',
        description: 'Setup inicial do banco',
        column: 'todo',
        assignedTo: null,
        inDevelopment: false,
        developmentBy: null,
        createdAt: new Date().toISOString(),
        order: 1
      }
    ], null, 2));
  }
}

// Helper functions to read/write JSON files
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON:', error);
    return [];
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing JSON:', error);
    return false;
  }
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const userId = req.headers['user-id'];
  if (!userId) {
    return res.status(401).json({ message: 'Token de acesso requerido' });
  }
  
  const users = readJSON(usersPath);
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ message: 'Usuário não encontrado' });
  }
  
  req.user = user;
  next();
}

// Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const users = readJSON(usersPath);
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } else {
    res.status(401).json({ success: false, message: 'Credenciais inválidas' });
  }
});

// Get all users
app.get('/api/users', authenticateToken, (req, res) => {
  const users = readJSON(usersPath);
  const usersWithoutPasswords = users.map(({ password, ...user }) => user);
  res.json(usersWithoutPasswords);
});

// Projects routes
app.get('/api/projects', authenticateToken, (req, res) => {
  const projects = readJSON(projectsPath);
  const userProjects = projects.filter(p => 
    p.members.includes(req.user.id) || p.createdBy === req.user.id
  );
  res.json(userProjects);
});

app.post('/api/projects', authenticateToken, (req, res) => {
  const { name, description } = req.body;
  const projects = readJSON(projectsPath);
  
  const newProject = {
    id: Date.now().toString(),
    name,
    description: description || '',
    status: 'Analisando',
    members: [req.user.id],
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    columns: [
      { id: 'todo', name: 'A Fazer', order: 0 },
      { id: 'progress', name: 'Em Progresso', order: 1 },
      { id: 'done', name: 'Finalizado', order: 2 }
    ]
  };
  
  projects.push(newProject);
  writeJSON(projectsPath, projects);
  res.json(newProject);
});

app.put('/api/projects/:id', authenticateToken, (req, res) => {
  const projects = readJSON(projectsPath);
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ message: 'Projeto não encontrado' });
  }
  
  const project = projects[projectIndex];
  if (project.createdBy !== req.user.id && !project.members.includes(req.user.id)) {
    return res.status(403).json({ message: 'Sem permissão para editar este projeto' });
  }
  
  projects[projectIndex] = { ...project, ...req.body };
  writeJSON(projectsPath, projects);
  res.json(projects[projectIndex]);
});

app.delete('/api/projects/:id', authenticateToken, (req, res) => {
  const projects = readJSON(projectsPath);
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ message: 'Projeto não encontrado' });
  }
  
  const project = projects[projectIndex];
  if (project.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Apenas o criador pode excluir o projeto' });
  }
  
  projects.splice(projectIndex, 1);
  writeJSON(projectsPath, projects);
  
  // Remove activities from this project
  const activities = readJSON(activitiesPath);
  const filteredActivities = activities.filter(a => a.projectId !== req.params.id);
  writeJSON(activitiesPath, filteredActivities);
  
  res.json({ message: 'Projeto excluído com sucesso' });
});

// Project columns routes
app.put('/api/projects/:id/columns', authenticateToken, (req, res) => {
  const projects = readJSON(projectsPath);
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ message: 'Projeto não encontrado' });
  }
  
  const project = projects[projectIndex];
  if (!project.members.includes(req.user.id) && project.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Sem permissão para editar este projeto' });
  }
  
  projects[projectIndex].columns = req.body.columns;
  writeJSON(projectsPath, projects);
  res.json(projects[projectIndex]);
});

// Activities routes
app.get('/api/projects/:projectId/activities', authenticateToken, (req, res) => {
  const activities = readJSON(activitiesPath);
  const projectActivities = activities.filter(a => a.projectId === req.params.projectId);
  res.json(projectActivities);
});

app.post('/api/projects/:projectId/activities', authenticateToken, (req, res) => {
  const { title, description, column } = req.body;
  const activities = readJSON(activitiesPath);
  
  const newActivity = {
    id: Date.now().toString(),
    projectId: req.params.projectId,
    title,
    description: description || '',
    column: column || 'todo',
    assignedTo: null,
    inDevelopment: false,
    developmentBy: null,
    createdAt: new Date().toISOString(),
    order: activities.filter(a => a.projectId === req.params.projectId && a.column === (column || 'todo')).length
  };
  
  activities.push(newActivity);
  writeJSON(activitiesPath, activities);
  res.json(newActivity);
});

app.put('/api/activities/:id', authenticateToken, (req, res) => {
  const activities = readJSON(activitiesPath);
  const activityIndex = activities.findIndex(a => a.id === req.params.id);
  
  if (activityIndex === -1) {
    return res.status(404).json({ message: 'Atividade não encontrada' });
  }
  
  activities[activityIndex] = { ...activities[activityIndex], ...req.body };
  writeJSON(activitiesPath, activities);
  res.json(activities[activityIndex]);
});

app.delete('/api/activities/:id', authenticateToken, (req, res) => {
  const activities = readJSON(activitiesPath);
  const activityIndex = activities.findIndex(a => a.id === req.params.id);
  
  if (activityIndex === -1) {
    return res.status(404).json({ message: 'Atividade não encontrada' });
  }
  
  activities.splice(activityIndex, 1);
  writeJSON(activitiesPath, activities);
  res.json({ message: 'Atividade excluída com sucesso' });
});

// Toggle development status
app.put('/api/activities/:id/development', authenticateToken, (req, res) => {
  const activities = readJSON(activitiesPath);
  const activityIndex = activities.findIndex(a => a.id === req.params.id);
  
  if (activityIndex === -1) {
    return res.status(404).json({ message: 'Atividade não encontrada' });
  }
  
  const activity = activities[activityIndex];
  
  if (activity.inDevelopment && activity.developmentBy !== req.user.id) {
    return res.status(403).json({ message: 'Esta atividade já está sendo desenvolvida por outro usuário' });
  }
  
  activities[activityIndex].inDevelopment = !activity.inDevelopment;
  activities[activityIndex].developmentBy = activities[activityIndex].inDevelopment ? req.user.id : null;
  
  writeJSON(activitiesPath, activities);
  res.json(activities[activityIndex]);
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});