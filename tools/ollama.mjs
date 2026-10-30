// tools/ollama.mjs — ask the local model through Ollama on this machine (sovereign: nothing leaves it). Plain node:http
// with no timeout, so a slow CPU never cuts a reply short; stream off, as the seal says. The model's digest and Ollama's
// version are read once, for the record.
import http from 'node:http';

const call = (path, body) => new Promise((resolve, reject) => {
  const data = body === undefined ? null : JSON.stringify(body);
  const req = http.request({ host: '127.0.0.1', port: 11434, path, method: data ? 'POST' : 'GET', headers: data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {} }, (res) => {
    let s = '';
    res.setEncoding('utf8'); res.on('data', (d) => { s += d; });
    res.on('end', () => { try { resolve(JSON.parse(s)); } catch { reject(new Error('Ollama replied ' + res.statusCode + ': ' + s.slice(0, 200))); } });
  });
  req.on('error', reject);
  if (data) req.write(data);
  req.end();
});

export const MODEL = 'qwen2.5:7b';

/** the model's digest and Ollama's version */
export async function provenance() {
  const tags = await call('/api/tags'), v = await call('/api/version'), m = tags.models.find((x) => x.name === MODEL);
  if (!m) throw new Error(MODEL + ' is not installed');
  return { model: MODEL, digest: m.digest, ollama: v.version, quantization: m.details && m.details.quantization_level };
}

/** one reply, stream off */
export async function ask(prompt, options) {
  const r = await call('/api/generate', { model: MODEL, prompt, stream: false, options });
  if (typeof r.response !== 'string') throw new Error('no reply: ' + JSON.stringify(r).slice(0, 200));
  return r.response;
}
