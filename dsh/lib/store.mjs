import { join, resolve, relative, isAbsolute } from 'node:path';
import { mkdir, realpath, lstat, readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';

export const KINDS = ['schools', 'professors', 'documents', 'interviews'];
const queues = new Map();
const hash = (text) => createHash('sha256').update(text).digest('hex');
const missing = (error) => ['ENOENT', 'FS_NOT_FOUND'].includes(error?.code) || /ENOENT|^cannot read .*: not found$/.test(error?.message ?? '');

export function text(value, max = 2000) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`文本必须为字符串且不超过 ${max} 字符`);
  return value;
}

export function recordOf(value, kind) {
  if (!KINDS.includes(kind) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('记录类型或内容无效');
  const record = {};
  for (const key of ['title', 'type', 'target', 'status', 'deadline', 'source', 'checkedAt', 'notes', 'content']) {
    record[key] = text(value[key] ?? '', key === 'content' ? 100000 : key === 'notes' ? 10000 : 2000);
  }
  if (!record.title.trim()) throw new Error('请填写标题');
  if (record.source && !/^https?:\/\//i.test(record.source)) throw new Error('来源链接需使用 http 或 https');
  if (record.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(record.deadline)) throw new Error('截止日期需为 YYYY-MM-DD');
  if (value.id !== undefined && !/^[a-zA-Z0-9-]{1,80}$/.test(value.id)) throw new Error('记录 ID 无效');
  record.id = value.id ?? randomUUID();
  record.updatedAt = new Date().toISOString();
  return record;
}

// 文件名固定；拒绝 .ra 或文件的符号链接，避免写出工作区。
async function safePath(cwd, file) {
  const root = await realpath(cwd);
  const dir = join(root, '.ra');
  for (const path of [dir, join(dir, file)]) {
    try {
      const info = await lstat(path);
      if (info.isSymbolicLink()) throw new Error('.ra 数据路径不能是符号链接');
      const actual = await realpath(path);
      const rel = relative(root, actual);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('数据路径超出工作区');
    } catch (error) { if (!missing(error)) throw error; }
  }
  return join(dir, file);
}

async function read(ctx, session, file, signal) {
  const path = await safePath(session.header.cwd, file);
  const target = await ctx.fs.resolve(path);
  try {
    if (await ctx.fs.stat(target, signal) === undefined) return { content: '', path };
    return { content: await ctx.fs.readText(target, signal), path };
  }
  catch (error) { if (missing(error)) return { content: '', path }; throw error; }
}

function parseState(content) {
  if (!content) return { version: 1, schools: [], professors: [], documents: [], interviews: [] };
  const state = JSON.parse(content);
  if (state.version !== 1 || KINDS.some((kind) => !Array.isArray(state[kind]))) throw new Error('工作台数据格式无效，请先核对 .ra/workbench.json');
  return state;
}

export async function readState(ctx, session, signal) {
  const [profile, workbench] = await Promise.all([
    read(ctx, session, 'memory.md', signal), read(ctx, session, 'workbench.json', signal),
  ]);
  return {
    profile: profile.content, profileRevision: hash(profile.content),
    profileExists: profile.content.length > 0, profilePath: profile.path,
    data: parseState(workbench.content), revision: hash(workbench.content),
    template: profile.content ? '' : await readFile(new URL('../templates/memory.md', import.meta.url), 'utf8'),
    writable: ctx.sandboxPolicy.resolve({ session }).mode !== 'read-only',
  };
}

export async function operate(ctx, session, args, signal) {
  if (!session?.header?.cwd || !isAbsolute(session.header.cwd)) throw new Error('会话没有有效工作区');
  if (args.action === 'read') return readState(ctx, session, signal);
  if (!['profile', 'upsert'].includes(args.action)) throw new Error('操作无效');
  const policy = ctx.sandboxPolicy.resolve({ session });
  if (policy.mode === 'read-only') throw new Error('当前会话为只读模式，不能保存');
  const key = resolve(session.header.cwd);
  const previous = queues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    signal?.throwIfAborted();
    const file = args.action === 'profile' ? 'memory.md' : 'workbench.json';
    const existing = await read(ctx, session, file, signal);
    if (typeof args.revision !== 'string' || hash(existing.content) !== args.revision) throw new Error('数据已被其他任务更新，请刷新后重新编辑');
    let content;
    if (args.action === 'profile') {
      content = text(args.markdown, 200000);
      if (!content.trim()) throw new Error('申请档案不能为空');
    } else {
      const state = parseState(existing.content);
      const item = recordOf(args.record, args.kind);
      const items = state[args.kind];
      const index = items.findIndex((row) => row.id === item.id);
      if (index < 0) items.unshift(item); else items[index] = { ...items[index], ...item };
      content = JSON.stringify(state, null, 2) + '\n';
    }
    await mkdir(join(key, '.ra'), { recursive: true });
    const target = await ctx.fs.resolve(await safePath(key, file));
    await ctx.fs.writeText(target, content, undefined, signal, policy);
    return readState(ctx, session, signal);
  });
  queues.set(key, current);
  try { return await current; }
  finally { if (queues.get(key) === current) queues.delete(key); }
}
