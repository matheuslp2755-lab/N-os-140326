import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Banco de Dados Próprio (Local JSON)
  const DB_PATH = path.resolve("db.json");
  console.log("Caminho do banco de dados:", DB_PATH);
  if (!fs.existsSync(DB_PATH)) {
    console.log("Criando novo arquivo db.json...");
    fs.writeFileSync(DB_PATH, JSON.stringify({ posts: [], users: [] }, null, 2));
  } else {
    console.log("db.json encontrado.");
  }

  // API Routes
  app.get("/api/posts", (req, res) => {
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      res.json(db.posts || []);
    } catch (e) {
      res.status(500).json({ error: "Erro ao ler posts" });
    }
  });

  app.post("/api/posts", (req, res) => {
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      const newPost = { 
        id: Date.now().toString(), 
        ...req.body, 
        timestamp: new Date().toISOString(),
        likes: [],
        comments: []
      };
      if (!db.posts) db.posts = [];
      db.posts.unshift(newPost);
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      res.json(newPost);
    } catch (e) {
      res.status(500).json({ error: "Erro ao criar post" });
    }
  });

  app.post("/api/posts/:id/like", (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    const { userId } = req.body;
    const post = db.posts.find((p: any) => p.id === req.params.id);
    if (post) {
      if (!Array.isArray(post.likes)) post.likes = [];
      const index = post.likes.indexOf(userId);
      if (index === -1) {
        post.likes.push(userId);
      } else {
        post.likes.splice(index, 1);
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      res.json(post);
    } else {
      res.status(404).json({ error: "Post não encontrado" });
    }
  });

  app.delete("/api/posts/:id", (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    const index = db.posts.findIndex((p: any) => p.id === req.params.id);
    if (index !== -1) {
      db.posts.splice(index, 1);
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Post não encontrado" });
    }
  });

  app.post("/api/auth/signup", (req, res) => {
    console.log("Recebendo pedido de signup:", req.body);
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      const { email, username, password, age } = req.body;
      
      if (!db.users) db.users = [];
      
      if (db.users.find((u: any) => u.email === email)) {
        return res.status(400).json({ error: "E-mail já cadastrado." });
      }
      
      const uid = Date.now().toString();
      const newUser = {
        uid,
        id: uid,
        email,
        username,
        username_lowercase: username.toLowerCase(),
        password,
        age,
        avatar: `https://picsum.photos/seed/${username}/200`,
        bio: "",
        createdAt: new Date().toISOString(),
        isVerified: false,
        isPrivate: false,
        appearOnRadar: true
      };
      
      db.users.push(newUser);
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      console.log("Usuário criado com sucesso:", newUser.username);
      res.json({ success: true, user: newUser });
    } catch (e) {
      console.error("Erro no signup:", e);
      res.status(500).json({ error: "Erro interno no servidor ao criar conta." });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    console.log("Recebendo pedido de login:", req.body.email);
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      const { email, password } = req.body;
      
      if (!db.users) db.users = [];
      
      const user = db.users.find((u: any) => u.email === email && u.password === password);
      if (!user) {
        return res.status(401).json({ error: "E-mail ou senha incorretos." });
      }
      
      res.json({ success: true, user });
    } catch (e) {
      console.error("Erro no login:", e);
      res.status(500).json({ error: "Erro interno no servidor ao fazer login." });
    }
  });

  app.get("/api/users/search", (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    const query = (req.query.q as string || "").toLowerCase();
    const results = db.users
      .filter((u: any) => 
        u.username.toLowerCase().includes(query) || 
        (u.nickname && u.nickname.toLowerCase().includes(query))
      )
      .map((u: any) => {
        const { password, ...safeUser } = u;
        return safeUser;
      })
      .slice(0, 15);
    res.json(results);
  });

  app.get("/api/users/:id", (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    const user = db.users.find((u: any) => u.id === req.params.id || u.uid === req.params.id);
    if (user) {
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } else {
      res.status(404).json({ error: "Usuário não encontrado" });
    }
  });

  app.post("/api/users/:id", (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    const userData = req.body;
    const index = db.users.findIndex((u: any) => u.uid === req.params.id || u.id === req.params.id);
    if (index !== -1) {
      db.users[index] = { ...db.users[index], ...userData };
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      const { password, ...safeUser } = db.users[index];
      res.json({ success: true, user: safeUser });
    } else {
      res.status(404).json({ error: "Usuário não encontrado" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Néos Server rodando em http://localhost:${PORT}`);
  });
}

startServer();
