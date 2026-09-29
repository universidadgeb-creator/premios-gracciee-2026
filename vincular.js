// Crea el proyecto de Apps Script DENTRO de la hoja de colaboradores y deja este folder listo
// para "npm run subir".
// Uso:  npm run vincular -- "https://docs.google.com/spreadsheets/d/XXXXXXXX/edit"
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const entrada = process.argv[2] || '';
const id = (entrada.match(/\/d\/([\w-]{20,})/) || [])[1] || (/^[\w-]{20,}$/.test(entrada) ? entrada : '');
if (!id) {
  console.error('Pega el link de la hoja entre comillas:\n' +
                '  npm run vincular -- "https://docs.google.com/spreadsheets/d/.../edit"');
  process.exit(1);
}

const config = path.join(__dirname, '.clasp.json');
if (fs.existsSync(config)) {
  console.error('Este folder ya está vinculado (' + config + '). Si quieres usar otra hoja, borra .clasp.json y repite.');
  process.exit(1);
}

// clasp descarga un Code.gs y un appsscript.json al crear el proyecto: se hace en una carpeta
// temporal para que no pise los archivos de aquí.
const clasp = '"' + path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'clasp.cmd' : 'clasp') + '"';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gracciee-'));
try {
  execSync(clasp + ' create-script --parentId ' + id + ' --title "Premios GRACCIEE 2026"', { cwd: tmp, stdio: 'inherit' });
  const { scriptId } = JSON.parse(fs.readFileSync(path.join(tmp, '.clasp.json'), 'utf8'));
  fs.writeFileSync(config, JSON.stringify({ scriptId: scriptId, parentId: [id], rootDir: 'apps-script' }, null, 2) + '\n');
  console.log('\nListo: la hoja quedó vinculada (scriptId ' + scriptId + '). Ahora ejecuta:  npm run subir');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
