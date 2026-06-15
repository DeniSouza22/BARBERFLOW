const API_URL = "http://localhost:3000";

const DB = {
  // Sincroniza os dados do JSON Server para o localStorage de forma robusta
  async sincronizarPuxar() {
    try {
      const resUser = await fetch(`${API_URL}/usuarios`);
      const resAgend = await fetch(`${API_URL}/agendamentos`);
      const resNotas = await fetch(`${API_URL}/notas`);
      
      if (resUser.ok && resAgend.ok && resNotas.ok) {
        const dbServer = {
          usuarios: await resUser.json(),
          agendamentos: await resAgend.json(),
          notas: await resNotas.json()
        };
        localStorage.setItem("bf_db", JSON.stringify(dbServer));
      }
    } catch (e) {
      console.log("Aviso: JSON Server offline, usando dados locais.");
    }
  },

  // Envia um item novo ou atualizado para o JSON Server
  async sincronizarEnviar(endpoint, dados, metodo = "POST", id = "") {
    try {
      const url = id ? `${API_URL}/${endpoint}/${id}` : `${API_URL}/${endpoint}`;
      await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
      });
      // Força uma atualização imediata após o envio para não quebrar o fluxo visual
      await this.sincronizarPuxar();
    } catch (e) {
      console.error("Erro ao persistir no arquivo db.json:", e);
    }
  },

  init() {
    if (!localStorage.getItem("bf_db")) {
      localStorage.setItem("bf_db", JSON.stringify({ usuarios: [], agendamentos: [], notas: [] }));
    }
    this.sincronizarPuxar();
  },

  get() {
    const localData = localStorage.getItem("bf_db");
    return localData ? JSON.parse(localData) : { usuarios: [], agendamentos: [], notas: [] };
  },

  save(db) {
    localStorage.setItem("bf_db", JSON.stringify(db));
  },

  getUsuarios() { return this.get().usuarios; },

  getUsuarioByEmail(email) {
    if (!email) return null;
    return this.get().usuarios.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
  },

  getUsuarioById(id) {
    return this.get().usuarios.find(u => String(u.id) === String(id));
  },

  criarUsuario(dados) {
    if (this.getUsuarioByEmail(dados.email)) {
      return { ok: false, msg: "Este e-mail já está cadastrado." };
    }
    const db = this.get();
    // Gerando ID como string para evitar qualquer incompatibilidade com JSON Server
    const novoUsuario = { 
      id: String(Date.now()), 
      ...dados, 
      dataCadastro: new Date().toISOString().slice(0, 10) 
    };
    
    db.usuarios.push(novoUsuario);
    this.save(db);
    
    this.sincronizarEnviar("usuarios", novoUsuario, "POST");
    return { ok: true, usuario: novoUsuario };
  },

  atualizarUsuario(id, campos) {
    const db = this.get();
    const idx = db.usuarios.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return false;
    
    db.usuarios[idx] = { ...db.usuarios[idx], ...campos };
    this.save(db);
    
    this.sincronizarEnviar("usuarios", db.usuarios[idx], "PUT", id);
    return true;
  },

  getAgendamentosByUsuario(usuarioId) {
    // Normalização defensiva: transforma os IDs em String para garantir a comparação correta
    return this.get().agendamentos.filter(a => String(a.usuarioId) === String(usuarioId));
  },

  criarAgendamento(dados) {
    const db = this.get();
    const novo = { 
      id: String(Date.now()), 
      ...dados, 
      usuarioId: String(dados.usuarioId),
      status: "confirmado" 
    };
    db.agendamentos.push(novo);
    this.save(db);
    
    this.sincronizarEnviar("agendamentos", novo, "POST");
    return novo;
  },

  cancelarAgendamento(id) {
    const db = this.get();
    const idx = db.agendamentos.findIndex(a => String(a.id) === String(id));
    if (idx === -1) return false;
    
    db.agendamentos[idx].status = "cancelado";
    this.save(db);
    
    this.sincronizarEnviar("agendamentos", db.agendamentos[idx], "PUT", id);
    return true;
  },

  getNotasByUsuario(usuarioId) {
    return this.get().notas.filter(n => String(n.usuarioId) === String(usuarioId));
  },

  salvarNota(usuarioId, texto) {
    const db = this.get();
    const idx = db.notas.findIndex(n => String(n.usuarioId) === String(usuarioId));
    
    const registro = {
      id: idx !== -1 ? String(db.notas[idx].id) : String(Date.now()),
      usuarioId: String(usuarioId),
      texto,
      data: new Date().toISOString().slice(0, 10)
    };
    
    if (idx !== -1) {
      db.notas[idx] = registro;
      this.save(db);
      this.sincronizarEnviar("notas", registro, "PUT", registro.id);
    } else {
      db.notas.push(registro);
      this.save(db);
      this.sincronizarEnviar("notas", registro, "POST");
    }
    
    return registro;
  },

  login(email, senha) {
    const u = this.getUsuarioByEmail(email);
    if (!u || u.senha !== senha) {
      return { ok: false, msg: "E-mail ou senha incorretos." };
    }
    return { ok: true, usuario: { id: String(u.id), nome: u.nome, email: u.email } };
  },

  usuarioLogado() {
    const s = sessionStorage.getItem("bf_user");
    return s ? JSON.parse(s) : null;
  },

  logout() {
    sessionStorage.removeItem("bf_user");
  }
};


DB.init();