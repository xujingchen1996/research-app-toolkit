// RA 工作台客户端，仅依赖 React 和公开的 DSH 槽位属性。
window.__ModuleLoader__.load({
  id: '@xujingchen1996/research-app-toolkit',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;
    const tabs = [
      { id: 'ra-profile', label: '申请档案', order: 50, page: 'profile' },
      { id: 'ra-targets', label: '选校与导师', order: 51, page: 'targets' },
      { id: 'ra-documents', label: '邮件与文书', order: 52, page: 'documents' },
      { id: 'ra-interviews', label: '面试准备', order: 53, page: 'interviews' },
    ];
    const kindLabels = { schools: '学校项目', professors: '导师', documents: '邮件与文书', interviews: '面试与演示' };
    const types = {
      schools: ['PhD', 'MRes', 'MPhil'], professors: ['导师匹配'],
      documents: ['套磁邮件', '跟进邮件', 'SOP', '动机信', '研究计划', '推荐信草稿', '研究空白分析'],
      interviews: ['模拟面试', '面试题库', '导师会面 PPT', '正式面试 PPT', '项目汇报'],
    };
    const skills = {
      schools: 'school-select', professors: 'professor-match',
      documents: 'document-assist', interviews: 'interview-prep',
    };
    const blank = (kind) => ({ title: '', type: types[kind][0], target: '', status: '待处理', deadline: '', source: '', checkedAt: '', notes: '', content: '' });
    const presetOf = (row) => row?.projectionValues?.agentPreset ?? row?.agentPreset;

    const CSS = `
.ra-panel { color:var(--dsw-alias-label-primary); padding:24px 24px 220px; height:100%; overflow:auto; box-sizing:border-box; }
.ra-panel * { box-sizing:border-box; }
.ra-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:20px; }
.ra-panel h2 { font-size:20px; margin:0 0 6px; font-weight:600; }
.ra-panel h3 { font-size:14px; margin:0 0 14px; }
.ra-muted { color:var(--dsw-alias-label-secondary); font-size:13px; line-height:1.6; margin:0; }
.ra-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.ra-button { padding:7px 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; cursor:pointer; }
.ra-button:disabled { opacity:.5; cursor:default; }
.ra-button:hover:not(:disabled), .ra-selected { background:var(--dsw-alias-interactive-bg-hover); }
.ra-primary { background:var(--dsw-alias-state-business-primary); color:var(--dsw-alias-label-on-primary,var(--dsw-alias-label-primary)); }
.ra-button:focus-visible, .ra-input:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.ra-card { border:1px solid var(--dsw-alias-border-l2); border-radius:12px; padding:18px; background:var(--dsw-alias-bg-layer-2); }
.ra-grid { display:grid; grid-template-columns:240px minmax(0,1fr); gap:18px; }
.ra-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-bottom:12px; }
.ra-field { display:flex; flex-direction:column; gap:6px; font-size:13px; margin-bottom:12px; }
.ra-input { width:100%; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); padding:9px 10px; font:inherit; font-size:13px; }
textarea.ra-input { resize:vertical; min-height:88px; line-height:1.6; }
.ra-profile-editor { min-height:400px !important; font-family:var(--dsw-font-mono,monospace) !important; }
.ra-content-editor { min-height:200px !important; }
.ra-record { display:block; width:100%; text-align:left; margin-top:8px; padding:12px; word-break:break-word; }
.ra-record strong { display:block; font-size:13px; margin-bottom:5px; }
.ra-alert { padding:10px 12px; margin-bottom:14px; border-radius:8px; background:var(--dsw-alias-interactive-bg-hover); font-size:13px; line-height:1.6; }
.ra-error { color:var(--dsw-alias-state-error-primary); }
.ra-path { font-family:var(--dsw-font-mono,monospace); overflow-wrap:anywhere; }
.ra-empty { padding:18px 0; }
.ra-category { margin-bottom:16px; }
@media(max-width:760px) { .ra-panel { padding:16px 16px 220px; } .ra-grid,.ra-fields { grid-template-columns:1fr; } .ra-head { flex-direction:column; } }
`;

    async function request(id, payload, signal) {
      const response = await fetch('/ra-api/state?sessionId=' + encodeURIComponent(id), {
        method: payload ? 'POST' : 'GET', signal,
        ...(payload ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) } : {}),
      });
      const value = await response.json();
      if (!value.ok) throw new Error(value.error || '请求失败');
      return value.state;
    }

    function Field({ label, value, onChange, multiline, ...rest }) {
      return h('label', { className: 'ra-field' }, label,
        h(multiline ? 'textarea' : 'input', { className: 'ra-input', value, onChange: (event) => onChange(event.target.value), ...rest }));
    }

    function useWorkbench(sessionId) {
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(true);
      const generation = useRef(0);
      useEffect(() => {
        const serial = ++generation.current;
        const controller = new AbortController();
        setState(null); setError(''); setLoading(true);
        const load = async () => {
          try {
            const value = await request(sessionId, null, controller.signal);
            if (generation.current === serial) { setState(value); setError(''); }
          } catch (error) { if (error.name !== 'AbortError' && generation.current === serial) setError(error.message); }
          finally { if (generation.current === serial) setLoading(false); }
        };
        load();
        const timer = setInterval(load, 5000);
        return () => { generation.current++; controller.abort(); clearInterval(timer); };
      }, [sessionId]);
      const refresh = async () => {
        const serial = generation.current;
        try { const value = await request(sessionId); if (serial === generation.current) { setState(value); setError(''); } }
        catch (error) { if (serial === generation.current) setError(error.message); }
      };
      const save = async (payload) => {
        const serial = generation.current;
        const value = await request(sessionId, payload);
        if (serial === generation.current) setState(value);
        return value;
      };
      return { state, error, loading, refresh, save };
    }

    function Profile({ store, prepare }) {
      const [draft, setDraft] = useState('');
      const [revision, setRevision] = useState('');
      const [dirty, setDirty] = useState(false);
      const [saving, setSaving] = useState(false);
      const [notice, setNotice] = useState('');
      const [error, setError] = useState('');
      useEffect(() => {
        if (!dirty) { setDraft(store.state.profile); setRevision(store.state.profileRevision); }
      }, [store.state.profileRevision, dirty]);
      const save = async () => {
        setSaving(true); setError('');
        try {
          const state = await store.save({ action: 'profile', markdown: draft, revision });
          setRevision(state.profileRevision); setDirty(false); setNotice('申请档案已保存');
        } catch (error) { setError(error.message); }
        finally { setSaving(false); }
      };
      return h('div', { className: 'ra-card' },
        h('p', { className: 'ra-muted ra-path' }, store.state.profilePath),
        h('p', { className: 'ra-muted' }, '九个申请技能共享此档案。保留 YAML 字段与原有章节，填写真实经历；保存前可先用 CV 分析建立结构。'),
        h('div', { className: 'ra-actions', style: { margin: '14px 0' } },
          h('button', { className: 'ra-button', onClick: () => prepare('cv-analyze', '请分析我的 CV，建立或更新共享申请档案；先确认 CV 文件路径。') }, '准备 CV 分析'),
          h('button', { className: 'ra-button', onClick: () => prepare('cv-polish', '请结合我的共享档案和目标项目优化 CV。') }, '准备 CV 优化'),
          !store.state.profileExists ? h('button', { className: 'ra-button', disabled: dirty, onClick: () => { setDraft(store.state.template); setDirty(true); setNotice('空白模板已填入，点击保存后写入工作区'); } }, '使用空白模板') : null),
        h(Field, { label: '共享申请档案（Markdown）', value: draft, multiline: true, className: 'ra-input ra-profile-editor', onChange: (value) => { setDraft(value); setDirty(true); setNotice(''); }, disabled: !store.state.writable }),
        error ? h('p', { className: 'ra-alert ra-error', role: 'alert' }, error) : notice ? h('p', { className: 'ra-alert', role: 'status' }, notice) : null,
        h('button', { className: 'ra-button ra-primary', disabled: !dirty || saving || !store.state.writable, onClick: save }, saving ? '正在保存…' : '保存申请档案'));
    }

    function Records({ kind, store, prepare }) {
      const [draft, setDraft] = useState(() => blank(kind));
      const [dirty, setDirty] = useState(false);
      const [revision, setRevision] = useState(store.state.revision);
      const [saving, setSaving] = useState(false);
      const [notice, setNotice] = useState('');
      const [error, setError] = useState('');
      const items = store.state.data[kind];
      useEffect(() => {
        if (!dirty) {
          const updated = items.find((item) => item.id === draft.id);
          if (updated) setDraft(updated);
          setRevision(store.state.revision);
        }
      }, [store.state.revision, dirty]);
      const change = (key, value) => { setDraft((prev) => ({ ...prev, [key]: value })); setDirty(true); setNotice(''); };
      const choose = (value) => {
        if (dirty && !window.confirm('有未保存的编辑，放弃编辑并切换记录？')) return;
        setDraft(value); setDirty(false); setRevision(store.state.revision); setError(''); setNotice('');
      };
      const save = async () => {
        setSaving(true); setError('');
        try {
          const state = await store.save({ action: 'upsert', kind, record: draft, revision });
          setDraft(state.data[kind].find((item) => item.id === draft.id) ?? state.data[kind][0]);
          setRevision(state.revision); setDirty(false); setNotice('记录已保存');
        } catch (error) { setError(error.message); }
        finally { setSaving(false); }
      };
      const prepareTask = () => {
        if (dirty || !draft.id) { setError('请先保存记录，再准备任务'); return; }
        const skill = kind === 'documents' && /邮件/.test(draft.type) ? 'cold-email'
          : kind === 'documents' && draft.type === '研究空白分析' ? 'gap-analysis'
          : kind === 'interviews' && /PPT|汇报/.test(draft.type) ? 'interview-ppt' : skills[kind];
        prepare(skill, `请使用 ra_workbench read 读取工作台，处理 ${kind} 中 id 为 ${draft.id} 的记录「${draft.title}」（${draft.type}）。结合共享申请档案与记录要求完成任务，再用 ra_workbench upsert 把结果写回此记录的 content，保留已有字段。模拟面试一次只问一个问题。`);
      };
      return h('div', { className: 'ra-grid' },
        h('aside', { className: 'ra-card' }, h('h3', null, `${kindLabels[kind]} · ${items.length}`),
          h('button', { className: 'ra-button', onClick: () => choose(blank(kind)) }, '新建记录'),
          items.length ? items.map((item) => h('button', {
            key: item.id, className: 'ra-button ra-record' + (draft.id === item.id ? ' ra-selected' : ''), onClick: () => choose(item),
          }, h('strong', null, item.title), h('span', { className: 'ra-muted' }, [item.type, item.status, item.deadline].filter(Boolean).join(' · '))))
            : h('p', { className: 'ra-muted ra-empty' }, '尚无记录。创建一条记录，填写目标与要求，再准备任务。')),
        h('section', { className: 'ra-card' },
          h('h3', null, draft.id ? '编辑记录' : '新建记录'),
          h('div', { className: 'ra-fields' },
            h(Field, { label: '标题', value: draft.title, onChange: (value) => change('title', value), required: true }),
            h('label', { className: 'ra-field' }, '任务类型', h('select', { className: 'ra-input', value: draft.type, onChange: (event) => change('type', event.target.value) }, types[kind].map((value) => h('option', { key: value }, value)))),
            h(Field, { label: '目标学校 / 导师 / 项目', value: draft.target, onChange: (value) => change('target', value) }),
            h('label', { className: 'ra-field' }, '状态', h('select', { className: 'ra-input', value: draft.status, onChange: (event) => change('status', event.target.value) }, ['待处理', '进行中', '待核实', '已完成', '已归档'].map((value) => h('option', { key: value }, value)))),
            h(Field, { label: '截止日期', type: 'date', value: draft.deadline, onChange: (value) => change('deadline', value) }),
            h(Field, { label: '来源链接', type: 'url', value: draft.source, onChange: (value) => change('source', value) })),
          h(Field, { label: '要求 / 备注', value: draft.notes, multiline: true, onChange: (value) => change('notes', value) }),
          h(Field, { label: '正文 / 分析 / 讲稿', value: draft.content, multiline: true, className: 'ra-input ra-content-editor', onChange: (value) => change('content', value) }),
          draft.checkedAt ? h('p', { className: 'ra-muted' }, '信息核验日期：' + draft.checkedAt) : null,
          error ? h('p', { className: 'ra-alert ra-error', role: 'alert' }, error) : notice ? h('p', { className: 'ra-alert', role: 'status' }, notice) : null,
          h('div', { className: 'ra-actions' },
            h('button', { className: 'ra-button ra-primary', disabled: !dirty || saving || !store.state.writable, onClick: save }, saving ? '正在保存…' : '保存记录'),
            h('button', { className: 'ra-button', disabled: !draft.id || dirty, onClick: prepareTask }, '准备任务'))));
    }

    function Workbench({ sessionId, tab, inputActions }) {
      const store = useWorkbench(sessionId);
      const [kind, setKind] = useState('schools');
      const [notice, setNotice] = useState('');
      const prepare = (skill, prompt) => {
        if (typeof inputActions?.setDraft !== 'function') { setNotice('当前无法填写对话输入框，请在对话中调用 /' + skill); return; }
        inputActions.setDraft('/' + skill + '\n' + prompt);
        setNotice('任务已填入对话输入框，切换到「对话」检查后发送。');
      };
      return h('div', { className: 'ra-panel' }, h('style', null, CSS),
        h('header', { className: 'ra-head' },
          h('div', null, h('h2', null, tab.label), h('p', { className: 'ra-muted' }, 'RA 科研申请工作台 · 数据保存在当前工作区 .ra/')),
          h('button', { className: 'ra-button', onClick: store.refresh }, '刷新数据')),
        notice ? h('p', { className: 'ra-alert', role: 'status' }, notice) : null,
        store.error ? h('p', { className: 'ra-alert ra-error', role: 'alert' }, store.error) : null,
        store.loading && !store.state ? h('p', { className: 'ra-muted' }, '正在读取工作台…') : null,
        store.state ? h(React.Fragment, null,
          !store.state.writable ? h('p', { className: 'ra-alert' }, '当前会话为只读模式，可查看记录；保存需使用可写权限。') : null,
          tab.page === 'profile' ? h(Profile, { store, prepare }) : h(React.Fragment, null,
            tab.page === 'targets' ? h('div', { className: 'ra-actions ra-category' }, ['schools', 'professors'].map((value) => h('button', { key: value, className: 'ra-button' + (kind === value ? ' ra-selected' : ''), onClick: () => setKind(value) }, kindLabels[value]))) : null,
            h(Records, { key: tab.page === 'targets' ? kind : tab.page, kind: tab.page === 'targets' ? kind : tab.page, store, prepare }))) : null);
    }

    function Gate(props) {
      const preset = props.useSessions((state) => presetOf(state.byId[props.sessionId]));
      if (preset !== 'research-app-toolkit') return null;
      return h(Workbench, { key: props.sessionId + props.tab.id, sessionId: props.sessionId, tab: props.tab, inputActions: props.inputActions });
    }

    function apply(ctx) {
      let showing = false;
      let disposers = [];
      const clear = () => { while (disposers.length) disposers.pop()(); };
      const sync = () => {
        const id = ctx.uiSession.adapter.current.getSnapshot().props?.sessionId;
        const visible = presetOf(ctx.sessions.list.getSnapshot().byId[id]) === 'research-app-toolkit';
        if (visible === showing) return;
        showing = visible;
        clear();
        if (visible) for (const tab of tabs) disposers.push(ctx.slots.inject('conversation.view', () => ctx.slots.register(
          { name: 'conversation.view', id: tab.id, order: tab.order, label: () => tab.label },
          (props) => h(Gate, { ...props, tab }),
        )));
      };
      const unsubscribe = ctx.sessions.list.subscribe(sync);
      const unsubscribeMain = ctx.uiSession.adapter.current.subscribe(sync);
      sync();
      ctx.effect(() => () => { unsubscribe(); unsubscribeMain(); clear(); }, 'RA 标签页生命周期');
    }
    return { apply, inject: ['slots', 'sessions', 'uiSession'] };
  },
});
