module.exports = {
  types: [
    { value: 'feat',     name: '✨ feat:     新增功能' },
    { value: 'fix',      name: '🐛 fix:      修复缺陷' },
    { value: 'docs',     name: '📝 docs:     文档变更' },
    { value: 'style',    name: '💄 style:    代码格式 (不影响代码运行的变动)' },
    { value: 'refactor', name: '♻️  refactor: 代码重构 (既不是新增功能，也不是修复缺陷)' },
    { value: 'perf',     name: '⚡️ perf:     性能优化' },
    { value: 'test',     name: '✅ test:     增加测试或修改测试' },
    { value: 'build',    name: '📦️ build:    构建过程或辅助工具相关的更改' },
    { value: 'ci',       name: '🎡 ci:       CI 配置或脚本的更改' },
    { value: 'chore',    name: '🔨 chore:    其他修改 (不在上述类型的杂项修改)' },
    { value: 'revert',   name: '⏪️ revert:   回滚代码' }
  ],

  // scope 类型（定义之后，可通过上下键选择）
  scopes: [
    ['components', '组件相关'],
    ['hooks', 'hook 相关'],
    ['utils', 'utils 相关'],
    ['styles', '样式相关'],
    ['deps', '依赖修改'],
    ['auth', '对 auth 修改'],
    ['other', '其他修改'],
    // 如果选择 custom，后面会提示输入自定义 scope
    ['custom', '以上都不是？我要自定义']
  ].map(([value, description]) => {
    return {
      value,
      name: `${value.padEnd(30)} (${description})`
    };
  }),

  // 是否允许自定义填写 scope，在 scope 选择的时候，会有 empty 和 custom 可以选择
  allowCustomScopes: true,

  // 询问步骤配置
  messages: {
    type: '请选择你要提交的更改类型：',
    scope: '\n请选择更改范围 (可选)：',
    // 如果 allowCustomScopes 为 true，并且跳过了 scope 列表去自定义，此处会提示
    customScope: '请输入自定义的更改范围：',
    subject: '请简明扼要地描述更改 (必填)：\n',
    body: '请提供更详细的说明，可以多行 (可选)。使用 "|" 换行：\n',
    breaking: '列出所有破坏性变更 (如无，直接回车跳过) (可选)：\n',
    footer: '列出本次更改修复或关联的 issues编号 (如无，直接回车跳过) (可选)：\n',
    confirmCommit: '确认使用以上信息提交吗？[y/n]'
  },

  // 跳过某些步骤
  skipQuestions: ['body', 'breaking', 'footer'],

  // subject 限制长度
  subjectLimit: 100
};
