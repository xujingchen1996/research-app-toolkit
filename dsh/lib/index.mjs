import { operate, text } from './store.mjs';

export const name = 'ra-studio';
export const inject = ['fs', 'tools', 'webServer', 'sessions', 'sandboxPolicy', 'sessionProjections', 'sessionController'];
const output = {
  schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  render: (_args, value) => [{ type: 'text', text: value.text }],
};

async function sessionFor(ctx, id) {
  if (typeof id !== 'string' || !id) throw new Error('缺少会话 ID');
  let session = ctx.sessions.get(id);
  if (!session) {
    // 由宿主恢复历史会话，沿用其日志、权限与生命周期，不构造伪会话。
    const result = await ctx.sessionController.resolveAgent(id);
    if (result.error) throw new Error(result.error.message);
    session = result.agent.session;
  }
  if (!session?.header?.cwd) throw new Error('会话没有工作区');
  const selected = ctx.sessionProjections.stateOf(session, 'agentPreset');
  if (selected !== 'research-app-toolkit') throw new Error('此会话未启用 RA 科研申请模式');
  return session;
}

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 512000) throw new Error('请求内容过大');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

export async function handle(ctx, req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ra-api/state') return send(res, 404, { ok: false, error: '接口不存在' });
    if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { ok: false, error: '请求方法不支持' });
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      if (origin && origin !== 'dsh-app://app' && new URL(origin).host !== req.headers.host) throw new Error('请求来源不匹配');
      if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('请求需使用 JSON');
    }
    const session = await sessionFor(ctx, url.searchParams.get('sessionId'));
    const args = req.method === 'GET' ? { action: 'read' } : await body(req);
    const state = await operate(ctx, session, args);
    return send(res, 200, { ok: true, state });
  } catch (error) { return send(res, 400, { ok: false, error: error.message }); }
}

export function workbenchTool(ctx) {
  return {
    name: 'ra_workbench',
    description: '读取或更新 RA 工作台，与四个标签页共享 .ra/memory.md 和 .ra/workbench.json。先 read 获取 revision，保存档案用 profile，学校/导师/文书/面试记录用 upsert；保留其他已有内容。',
    parameters: {
      type: 'object', properties: {
        action: { type: 'string', enum: ['read', 'profile', 'upsert'] },
        payload: { type: 'string', description: 'JSON 字符串：profile 用 markdown/revision；upsert 用 kind/record/revision。kind 为 schools、professors、documents、interviews。记录包含 title、type、target、status、deadline、source、checkedAt、notes、content，更新时保留 id。' },
      }, required: ['action'], additionalProperties: false,
    },
    output,
    async execute(args, exec) {
      const session = await sessionFor(ctx, exec.agent?.session?.id);
      const payload = args.payload ? JSON.parse(text(args.payload, 400000)) : {};
      const state = await operate(ctx, session, { ...payload, action: args.action }, exec.signal);
      return { text: JSON.stringify(state) };
    },
  };
}

export function apply(ctx, config = {}) {
  if (config.mode === 'tools') {
    ctx.effect(() => ctx.tools.register(workbenchTool(ctx)), 'RA 工作台模型工具');
  } else {
    ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/ra-api', handler: (req, res) => handle(ctx, req, res) }), 'RA 工作台接口');
  }
}
