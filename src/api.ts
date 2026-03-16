
// Centralized API for the custom database
export const api = {
  auth: {
    signup: async (data: any) => {
      try {
        const url = '/api/auth/signup';
        console.log(`Chamando API: ${url}`);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          return await res.json();
        } else {
          const text = await res.text();
          console.error("Resposta não JSON recebida (signup):", text.substring(0, 200));
          return { error: "O servidor não respondeu corretamente. Tente novamente." };
        }
      } catch (e) {
        return { error: "Não foi possível conectar ao servidor." };
      }
    },
    login: async (data: any) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          return await res.json();
        } else {
          const text = await res.text();
          console.error("Resposta não JSON recebida (login):", text.substring(0, 200));
          return { error: "O servidor não respondeu corretamente. Tente novamente." };
        }
      } catch (e) {
        return { error: "Não foi possível conectar ao servidor." };
      }
    }
  },
  users: {
    get: async (id: string) => {
      const res = await fetch(`/api/users/${id}`);
      return res.json();
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    search: async (query: string) => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      return res.json();
    }
  },
  posts: {
    list: async () => {
      const res = await fetch('/api/posts');
      return res.json();
    },
    create: async (data: any) => {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    like: async (postId: string, userId: string) => {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      return res.json();
    },
    delete: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE'
      });
      return res.json();
    }
  }
};
