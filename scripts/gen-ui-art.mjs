// Generates UI art (hero portraits + stat icons) via the OpenAI Images API (gpt-image-1)
// into public/assets/ui/. Reads OPENAI_API_KEY from .env or the environment.
// Run: node scripts/gen-ui-art.mjs   (optionally pass asset names to regenerate a subset)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

// --- load .env (no dependency) ---
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const KEY = process.env.OPENAI_API_KEY || process.env.API_KEY;
if (!KEY) {
  console.error('Missing key. Put OPENAI_API_KEY=sk-... (or API_KEY=sk-...) in .env (gitignored) or the environment.');
  process.exit(1);
}

const STYLE =
  'pixel art, 16-bit retro RPG style, crisp pixels, bold limited color palette, Filipino mythology theme, ' +
  'fully transparent background, no text, no words, no letters, no frame, single subject centered';

const ASSETS = [
  { file: 'portrait-lapulapu.png', quality: 'medium',
    prompt: `Heroic portrait bust of Lapu-Lapu, a proud Filipino warrior chieftain wielding a bolo sword, tribal armor, fierce and noble. ${STYLE}` },
  { file: 'portrait-gabriela.png', quality: 'medium',
    prompt: `Heroic portrait bust of Gabriela Silang, a brave Filipina revolutionary woman holding a bolo, determined expression, red kerchief. ${STYLE}` },
  { file: 'portrait-bernardo.png', quality: 'medium',
    prompt: `Heroic portrait bust of Bernardo Carpio, a Filipino legendary strongman, muscular, cracked-stone and earth motif around him, mighty. ${STYLE}` },
  { file: 'portrait-diwata.png', quality: 'medium',
    prompt: `Portrait bust of a Diwata, a graceful Filipino forest deity, ethereal woman crowned with leaves and flowers, soft cyan-green glow. ${STYLE}` },
  { file: 'portrait-mangkukulam.png', quality: 'medium',
    prompt: `Portrait bust of a Mangkukulam, a dark Filipino sorcerer/curse-caster, hooded, glowing purple curse energy and a small voodoo doll. ${STYLE}` },
  { file: 'icon-lives.png', quality: 'low',
    prompt: `A single glossy red heart game UI icon. ${STYLE}` },
  { file: 'icon-gold.png', quality: 'low',
    prompt: `A single shiny gold coin game UI icon. ${STYLE}` },
  { file: 'icon-wave.png', quality: 'low',
    prompt: `A single cresting blue water wave game UI icon, stylized. ${STYLE}` },
];

const only = process.argv.slice(2);
const todo = only.length ? ASSETS.filter((a) => only.some((n) => a.file.includes(n))) : ASSETS;

mkdirSync('public/assets/ui', { recursive: true });

for (const a of todo) {
  process.stdout.write(`generating ${a.file} (${a.quality}) ... `);
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: a.prompt,
      size: '1024x1024',
      quality: a.quality,
      background: 'transparent',
      n: 1,
    }),
  });
  if (!res.ok) {
    console.error('\nAPI error', res.status);
    console.error(await res.text());
    process.exit(1);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    console.error('\nNo image in response:', JSON.stringify(json).slice(0, 400));
    process.exit(1);
  }
  writeFileSync(`public/assets/ui/${a.file}`, Buffer.from(b64, 'base64'));
  console.log('ok');
}
console.log(`done — wrote ${todo.length} file(s) to public/assets/ui/`);
