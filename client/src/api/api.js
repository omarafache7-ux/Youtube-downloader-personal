import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function createDownload(url, format) {
  const { data } = await axios.post(`${API_BASE}/downloads`, { url, format });
  return data;
}

export async function listDownloads() {
  const { data } = await axios.get(`${API_BASE}/downloads`);
  return data;
}

export async function getDownload(id) {
  const { data } = await axios.get(`${API_BASE}/downloads/${id}`);
  return data;
}

export async function deleteDownload(id) {
  await axios.delete(`${API_BASE}/downloads/${id}`);
}

export function fileUrl(id) {
  return `${API_BASE}/downloads/${id}/file`;
}
