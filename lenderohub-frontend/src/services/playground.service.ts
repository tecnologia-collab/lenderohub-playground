const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const playgroundService = {
  async getHealthStatus() {
    const res = await fetch(`${API_BASE}/v1/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async getMockBalance() {
    const res = await fetch(`${API_BASE}/v1/mock-finco/accounts/mock-001/balance`);
    if (!res.ok) throw new Error('Error al obtener balance');
    return res.json();
  },

  async getMockInstruments() {
    const res = await fetch(`${API_BASE}/v1/mock-finco/instruments`);
    if (!res.ok) throw new Error('Error al obtener instrumentos');
    return res.json();
  },
};