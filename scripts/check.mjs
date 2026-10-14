import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    files.push(...(entry.isDirectory() ? await walk(path) : [path]));
  }
  return files;
}

const roots = ['bin', 'lib', 'test', 'scripts', 'dsh'];
let count = 0;
for (const root of roots) {
  for (const path of await walk(root)) {
    const text = await readFile(path, 'utf8');
    if (!text.endsWith('\n') || /[ \t]+$/m.test(text)) throw new Error(`${path} 的换行或尾随空白格式不符合约定`);
    if (/\.(?:js|mjs)$/.test(path)) {
      if (text.split('\n').length > 1000) throw new Error(`${path} 超过 1000 行`);
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    }
    if (path.endsWith('.json')) JSON.parse(text);
    if (path.endsWith('.yml')) parse(text, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value) => value }] });
    count++;
  }
}
console.log(`语法、格式与资源检查通过，共 ${count} 个文件`);
