import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, readdir, mkdir, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { installDshHost, parseArgs } from '../lib/installer.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const schema = { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value) => ({ expression: value }) }] };

test('安装参数支持 --dsh，不改变原 Claude/Codex 选择', () => {
  const args = parseArgs(['install', '--dsh']);
  assert.equal(args.options.dsh, true);
  assert.equal(args.options.codex, false);
  assert.equal(args.options.claude, false);
});

test('没有 DSH 时也能预安装，且不创建 profile 或修改其他主机', async () => {
  const homeDir = await mkdtemp(join(tmpdir(), 'ratk-no-dsh-'));
  try {
    const result = await installDshHost({ sourceDir: root, version: '0.3.0', homeDir });
    assert.equal(result.activationRequired, true);
    assert.deepEqual(await readdir(homeDir), ['.dsh']);
    assert.deepEqual(await readdir(join(homeDir, '.dsh')), ['bundles']);
    assert.ok((await readFile(join(result.pluginDir, 'dsh/lib/client.js'), 'utf8')).includes('申请档案'));
    const meta = JSON.parse(await readFile(join(result.pluginDir, 'package.json'), 'utf8'));
    assert.equal(meta.dsh.bundle.patch, './dsh/cordis.patch.yml');
    assert.equal((await readdir(join(result.pluginDir, 'dsh/skills'))).length, 9);
    const second = await installDshHost({ sourceDir: root, version: '0.3.0', homeDir });
    assert.ok(second.backupDir);
    assert.ok((await readFile(join(second.backupDir, 'dsh/cordis.patch.yml'), 'utf8')).includes('preset-research-app-toolkit'));
  } finally { await rm(homeDir, { recursive: true, force: true }); }
});

test('资源定位在含空格的安装目录和任意 profile 中仍然正确', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'ratk portable '));
  try {
    const result = await installDshHost({ sourceDir: root, version: '0.3.0', homeDir: temp });
    const profile = join(temp, 'custom profile');
    const scope = join(profile, 'node_modules/@xujingchen1996');
    await mkdir(scope, { recursive: true });
    await symlink(result.pluginDir, join(scope, 'research-app-toolkit'), process.platform === 'win32' ? 'junction' : 'dir');
    const rows = parse(await readFile(join(result.pluginDir, 'dsh/cordis.patch.yml'), 'utf8'), schema)[0].insert;
    assert.equal(rows[0].name, '@xujingchen1996/research-app-toolkit');
    const preset = rows.find((row) => row.id === 'preset-research-app-toolkit');
    const provider = preset.config.plugins.find((row) => row.id === 'skill-filesystem');
    const expression = provider.config.customSkillDirs[0].expression;
    const baseUrl = pathToFileURL(profile + '/').href;
    // 只执行本包编写的受控资源表达式，用临时 profile 检查真实 Node 包解析。
    const value = new Function('process', 'baseUrl', `return (${expression});`)(process, baseUrl);
    assert.equal(value, await realpath(join(result.pluginDir, 'dsh/skills')));
    assert.ok(!JSON.stringify(rows).includes('/Users/'));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
