const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// data klasörü ve JSON dosyalarını kontrol
const DATA_DIR = path.join(__dirname, 'data');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');
const VOTERS_FILE = path.join(DATA_DIR, 'voters.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// JSON okuma / yazma fonksiyonları
function readJSON(file, defaultVal){
  try{ return JSON.parse(fs.readFileSync(file, 'utf8')); }catch(e){ return defaultVal; }
}
function writeJSON(file, obj){ fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }

let votes = readJSON(VOTES_FILE, { teamA: 0, teamB: 0 });
let voters = readJSON(VOTERS_FILE, {});

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// public klasörünü static olarak serv et
app.use(express.static(path.join(__dirname, 'public')));

// kök URL yönlendirme (display sayfasına)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/display.html'));
});

// oy gönderme API
app.post('/api/vote', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if(!ip) return res.status(400).json({ error: 'IP alınamadı' });

  if (voters[ip]) return res.status(429).json({ error: 'Bu cihaz/IP zaten oy kullandı' });

  const { choice } = req.body || {};
  if (!choice || !['teamA','teamB'].includes(choice)) return res.status(400).json({ error: 'Geçersiz seçim' });

  votes[choice] += 1;
  voters[ip] = true;

  writeJSON(VOTES_FILE, votes);
  writeJSON(VOTERS_FILE, voters);

  io.emit('votes-updated', votes);
  return res.json({ ok: true, votes });
});

// reset API
app.post('/api/reset', (req, res) => {
  votes = { teamA: 0, teamB: 0 };
  voters = {};
  writeJSON(VOTES_FILE, votes);
  writeJSON(VOTERS_FILE, voters);
  io.emit('votes-updated', votes);
  return res.json({ ok: true });
});

// socket.io connection
io.on('connection', (socket) => {
  socket.emit('votes-updated', votes);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
// /vote → oy verme sayfası
app.get('/vote', (req, res) => {
  res.sendFile(path.join(__dirname, 'munazara-oylama.onrender.com/vote.html'));
});

