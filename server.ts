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
  const DB_PATH = path.join(process.cwd(), "db.json");
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ posts: [], users: [] }, null, 2));
  }

  // API Routes
  app.get("/api/posts", (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    res.json(db.posts);
  });

  app.post("/api/posts", (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    const newPost = { id: Date.now().toString(), ...req.body, timestamp: new Date().toISOString() };
    db.posts.unshift(newPost);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    res.json(newPost);
  });

  app.get("/api/users/:id", (req, res) => {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    const user = db.users.find((u: any) => u.id === req.params.id);
    res.json(user || { id: req.params.id, username: "Usuário Néos", bio: "Bem-vindo à Néos!" });
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
