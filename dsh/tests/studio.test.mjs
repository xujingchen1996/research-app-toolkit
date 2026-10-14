import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, symlink, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import vm from 'node:vm';
import { operate, recordOf } from '../lib/store.mjs';
import { handle, workbenchTool } from '../lib/index.mjs';

async function fixture(fn) {
  const cwd = await mkdtemp(join(tmpdir(), 'ra-studio-'));
  const session = { id: 'test', header: { cwd } };
  const ctx = {
    fs: { resolve: async (path) => path, stat: async (path) => { try { return await stat(path); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } }, readText: (path) => readFile(path, 'utf8'), writeText: (path, text) => writeFile(path, text) },
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: cwd }) },
    sessions: { get: (id) => id === session.id ? session : undefined },
    sessionProjections: { stateOf: () => 'research-app-toolkit' },
  };
  try { await fn(ctx, session); } finally { await rm(cwd, { recursive: true, force: true }); }
}

test('只读加载不创建文件；档案与四类记录持久化', async () => fixture(async (ctx, session) => {
  let state = await operate(ctx, session, { action: 'read' });
  assert.equal(state.profileExists, false);
  assert.ok(state.template.includes('cv_profile_analyzed: false'));
  assert.deepEqual(await readdir(session.header.cwd), []);
  state = await operate(ctx, session, { action: 'profile', markdown: state.template, revision: state.profileRevision });
  assert.equal(state.profile, state.template || await readFile(join(session.header.cwd, '.ra/memory.md'), 'utf8'));
  for (const kind of ['schools', 'professors', 'documents', 'interviews']) {
    state = await operate(ctx, session, { action: 'upsert', kind, revision: state.revision, record: { title: kind + '验收', content: '真实测试内容', source: 'https://example.org' } });
    assert.equal(state.data[kind].length, 1);
  }
  const saved = JSON.parse(await readFile(join(session.header.cwd, '.ra/workbench.json'), 'utf8'));
  assert.equal(saved.documents[0].content, '真实测试内容');
}));

test('输入与路径校验拒绝无效数据、符号链接和只读写入', async () => fixture(async (ctx, session) => {
  assert.throws(() => recordOf({ title: 'x', source: 'javascript:alert(1)' }, 'schools'), /http/);
  assert.throws(() => recordOf({ title: 'x', id: '../escape' }, 'documents'), /ID/);
  const state = await operate(ctx, session, { action: 'read' });
  ctx.sandboxPolicy.resolve = () => ({ mode: 'read-only' });
  await assert.rejects(operate(ctx, session, { action: 'profile', markdown: 'x', revision: state.profileRevision }), /只读/);
  assert.deepEqual(await readdir(session.header.cwd), []);
  ctx.sandboxPolicy.resolve = () => ({ mode: 'workspace-write' });
  const outside = await mkdtemp(join(tmpdir(), 'ra-outside-'));
  try {
    await symlink(outside, join(session.header.cwd, '.ra'));
    await assert.rejects(operate(ctx, session, { action: 'read' }), /符号链接/);
    assert.deepEqual(await readdir(outside), []);
  } finally { await rm(outside, { recursive: true, force: true }); }
}));

test('旧 revision 与并发保存不能覆盖新记录；不同工作区隔离', async () => fixture(async (ctx, session) => {
  const initial = await operate(ctx, session, { action: 'read' });
  const args = { action: 'upsert', kind: 'documents', revision: initial.revision, record: { title: '文书' } };
  const results = await Promise.allSettled([operate(ctx, session, args), operate(ctx, session, args)]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.match(results.find((item) => item.status === 'rejected').reason.message, /刷新/);
  const state = await operate(ctx, session, { action: 'read' });
  assert.equal(state.data.documents.length, 1);
  await fixture(async (otherCtx, otherSession) => {
    const other = await operate(otherCtx, otherSession, { action: 'read' });
    assert.deepEqual(other.data.documents, []);
  });
}));

test('集成：真实 HTTP 与模型工具复用相同存储，错误可见', async () => fixture(async (ctx, session) => {
  const server = createServer((req, res) => handle(ctx, req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/ra-api/state?sessionId=test`;
  try {
    const before = await (await fetch(endpoint)).json();
    assert.equal(before.ok, true);
    const tool = workbenchTool(ctx);
    const result = await tool.execute({ action: 'upsert', payload: JSON.stringify({ kind: 'schools', revision: before.state.revision, record: { title: '工具创建的学校' } }) }, { agent: { session } });
    const state = JSON.parse(result.text);
    const uiRead = await (await fetch(endpoint)).json();
    assert.deepEqual(uiRead.state.data, state.data);
    const changed = await (await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'upsert', kind: 'schools', revision: state.revision, record: { ...state.data.schools[0], notes: '界面更新' } }) })).json();
    assert.equal(changed.ok, true);
    const toolRead = JSON.parse((await tool.execute({ action: 'read' }, { agent: { session } })).text);
    assert.equal(toolRead.data.schools[0].notes, '界面更新');
    const dataPath = join(session.header.cwd, '.ra/workbench.json');
    const extended = JSON.parse(await readFile(dataPath, 'utf8'));
    extended.schools[0].extra = { verified: true };
    await writeFile(dataPath, JSON.stringify(extended));
    const fresh = await operate(ctx, session, { action: 'read' });
    const preserved = await operate(ctx, session, { action: 'upsert', kind: 'schools', revision: fresh.revision, record: { ...fresh.data.schools[0], title: '更新标题' } });
    assert.deepEqual(preserved.data.schools[0].extra, { verified: true });
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' })).status, 400);
    ctx.sessionProjections.stateOf = () => 'standard';
    assert.equal((await fetch(endpoint)).status, 400);
    await assert.rejects(tool.execute({ action: 'read' }, { agent: { session } }), /未启用/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
}));

test('客户端会话切换注册四个标签页，退出 RA 和卸载都清理', async () => {
  let plugin;
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { window: { __ModuleLoader__: { load: (value) => { plugin = value.factory(() => ({ createElement() {} })); } } } });
  let row = { projectionValues: { agentPreset: 'research-app-toolkit' } };
  let active = 'ra';
  let syncList; let syncMain; let cleanup;
  const registered = new Map();
  const ctx = {
    sessions: { list: { getSnapshot: () => ({ byId: { ra: row } }), subscribe: (fn) => { syncList = fn; return () => {}; } } },
    uiSession: { adapter: { current: { getSnapshot: () => ({ props: { sessionId: active } }), subscribe: (fn) => { syncMain = fn; return () => {}; } } } },
    slots: {
      register: (options) => { registered.set(options.id, options); return () => registered.delete(options.id); },
      inject: (_name, callback) => callback(),
    },
    effect: (fn) => { cleanup = fn(); },
  };
  plugin.apply(ctx);
  assert.equal(registered.size, 4);
  row = { projectionValues: { agentPreset: 'standard' } }; syncList();
  assert.equal(registered.size, 0);
  row = { projectionValues: { agentPreset: 'research-app-toolkit' } }; syncList();
  assert.equal(registered.size, 4);
  active = 'missing'; syncMain();
  assert.equal(registered.size, 0);
  active = 'ra'; syncMain(); cleanup();
  assert.equal(registered.size, 0);
});

test('源码与资源格式：无尾随空白，文件大小符合约定', async () => {
  for (const path of ['lib/client.js', 'lib/index.mjs', 'lib/store.mjs', '../package.json', 'cordis.patch.yml']) {
    const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
    assert.ok(source.endsWith('\n'));
    assert.ok(!/[ \t]+$/m.test(source));
    assert.ok(source.split('\n').length <= 1000);
    if (path.endsWith('.json')) assert.equal(source, JSON.stringify(JSON.parse(source), null, 2) + '\n');
  }
});

// 历史会话必须通过宿主恢复，不能退回默认权限或伪造工作区。
test('历史会话恢复沿用真实会话权限并能读取工作台', async () => fixture(async (ctx, session) => {
  ctx.sessions.get = () => undefined;
  let restored = 0;
  ctx.sessionController = { resolveAgent: async (id) => { assert.equal(id, session.id); restored++; return { agent: { session } }; } };
  ctx.sandboxPolicy.resolve = ({ session: actual }) => { assert.equal(actual, session); return { mode: 'read-only' }; };
  const result = await workbenchTool(ctx).execute({ action: 'read' }, { agent: { session } });
  assert.equal(JSON.parse(result.text).writable, false);
  assert.equal(restored, 1);
  ctx.sessionController.resolveAgent = async () => ({ error: { message: '会话不存在' } });
  await assert.rejects(workbenchTool(ctx).execute({ action: 'read' }, { agent: { session } }), /会话不存在/);
}));
