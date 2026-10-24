// Ricordo del telefono abilitato all'accesso con QR, in un cookie messo dal server del sito.
// Su iPhone Safari cancella dopo circa 7 giorni i dati salvati dalla pagina (localStorage),
// ma non i cookie messi dal server: così il telefono resta abilitato e basta inquadrare il QR.
//   GET    → { id, segreto } oppure {}      POST { id, segreto } → salva      DELETE → toglie
const NOME = 'qr_telefono';
const UN_ANNO = 365 * 86400;

function leggi(req) {
  const m = new RegExp('(?:^|;\\s*)' + NOME + '=([^;]+)').exec(req.headers.cookie || '');
  if (!m) return null;
  const [id, segreto] = decodeURIComponent(m[1]).split('.');
  return id && segreto ? { id, segreto } : null;
}
function cookie(valore, durata) {
  return NOME + '=' + valore + '; Max-Age=' + durata + '; Path=/api/telefono-qr; HttpOnly; Secure; SameSite=Lax';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json(leggi(req) || {});
  // solo dalle pagine del programma (stesso sito)
  const origine = req.headers.origin;
  if (origine && origine !== 'https://' + req.headers.host) return res.status(403).json({ error: 'non permesso' });
  if (req.method === 'POST') {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    const id = String((b && b.id) || ''), segreto = String((b && b.segreto) || '');
    if (!/^[\w-]{1,80}$/.test(id) || !/^[\w-]{10,200}$/.test(segreto)) return res.status(400).json({ error: 'dati non validi' });
    res.setHeader('Set-Cookie', cookie(encodeURIComponent(id + '.' + segreto), UN_ANNO));
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookie('', 0));
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'metodo non permesso' });
}
