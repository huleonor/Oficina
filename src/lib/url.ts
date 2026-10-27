// Prefixa caminhos internos com a base do site (ex.: /Oficina/ no GitHub Pages, / num domínio próprio).
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const u = (path: string) => (path.startsWith('/') ? `${base}${path}` : path);
