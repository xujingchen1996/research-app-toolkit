import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmRoot = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], { encoding: 'utf8' });
const modules = process.env.DSH_NODE_MODULES ?? join(npmRoot.stdout.trim(), '@deepseek-ai/dsh/node_modules');
if (!existsSync(join(modules, '@deepseek-ai/dsh-skill-filesystem/lib/index.js'))) throw new Error('未找到 DSH 运行时；可设置 DSH_NODE_MODULES 后重试。普通 npm test 无须 DSH。');
const patch = parse(await readFile(join(root, 'dsh/cordis.patch.yml'), 'utf8'), {
  customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value) => ({ expression: value }) }],
});
const preset = patch[0].insert.find((row) => row.id === 'preset-research-app-toolkit');
const evaluate = (value) => {
  if (Array.isArray(value)) return value.map(evaluate);
  if (value && typeof value === 'object') {
    if (typeof value.expression === 'string') return new Function('process', 'baseUrl', `return (${value.expression});`)(process, pathToFileURL(root).href);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, evaluate(item)]));
  }
  return value;
};
const flatten = (rows) => rows.flatMap((row) => [row, ...(row.group ? flatten(row.config) : [])]);
for (const row of flatten(preset.config.plugins)) {
  if (row.group) continue;
  const location = row.name === '@xujingchen1996/research-app-toolkit' ? join(root, 'dsh/lib/index.mjs') : join(modules, row.name, 'lib/index.js');
  const module = await import(pathToFileURL(location));
  const schema = module.Config ?? module.default?.Config;
  if (schema) assert.ok(!(await schema['~standard'].validate(evaluate(row.config ?? {}))).issues?.length, row.id);
}
const { FileSystemSkillProvider } = await import(pathToFileURL(join(modules, '@deepseek-ai/dsh-skill-filesystem/lib/index.js')));
const controller = new AbortController();
const warnings = [];
const provider = new FileSystemSkillProvider({ get: () => undefined, logger: { warn: (value) => warnings.push(value) } }, { signal: controller.signal, invalidate() {} }, {
  includeDefaultRoots: false, watch: false, customSkillDirs: [resolve(root, 'dsh/skills')],
});
try {
  const candidates = await provider.list({ cwd: root, signal: controller.signal });
  assert.equal(candidates.length, 9);
  for (const candidate of candidates) {
    const skill = await provider.get(candidate, { signal: controller.signal });
    assert.ok(skill.content.length > 300);
    assert.ok(skill.content.includes('../../references/shared-state.md'));
  }
  assert.deepEqual(warnings, []);
  console.log('DSH 实际 schema 与九技能发现/加载检查通过');
} finally { controller.abort(); await provider.dispose(); }
