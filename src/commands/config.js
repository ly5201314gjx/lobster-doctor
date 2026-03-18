const fs = require('fs');
const path = require('path');
const { getOpenClawHome } = require('../core/paths');
const { makeSummary, printList } = require('../core/report');

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    return { __error: err.message };
  }
}

function normalizePrimaryModel(config) {
  const primary = config?.agents?.defaults?.model?.primary;
  if (typeof primary === 'string' && primary.trim()) return primary.trim();

  const defaultsModel = config?.agents?.defaults?.model;
  if (typeof defaultsModel === 'string' && defaultsModel.trim()) return defaultsModel.trim();

  const agentModel = config?.agent?.model;
  if (typeof agentModel === 'string' && agentModel.trim()) return agentModel.trim();

  return '(未设置)';
}

function normalizeTelegramStream(config) {
  const tg = config?.channels?.telegram || {};
  if (typeof tg.streamMode === 'string' && tg.streamMode.trim()) return tg.streamMode.trim();
  if (typeof tg.streaming === 'boolean') return tg.streaming ? 'legacy:true' : 'legacy:false';
  return '(未设置)';
}

function analyzeConfig(config, configFile) {
  const primaryModel = normalizePrimaryModel(config);
  const telegramMode = normalizeTelegramStream(config);
  const modelMode = config?.models?.mode || '(未设置)';

  const good = [];
  const warnings = [];
  const bad = [];

  const knownModelModes = new Set(['alias', 'direct', 'router']);
  const knownTelegramModes = new Set(['edit', 'replace', 'final-only', 'off', 'legacy:true', 'legacy:false']);

  if (primaryModel !== '(未设置)') good.push(`主模型已设置: ${primaryModel}`);
  else bad.push('agents.defaults.model.primary 未设置');

  if (modelMode !== '(未设置)') {
    if (knownModelModes.has(modelMode)) good.push(`models.mode 看起来正常: ${modelMode}`);
    else warnings.push(`models.mode 看起来不是常见值: ${modelMode}`);
  } else {
    warnings.push('models.mode 未显式配置');
  }

  if (telegramMode !== '(未设置)') {
    if (knownTelegramModes.has(telegramMode)) good.push(`Telegram stream 配置存在: ${telegramMode}`);
    else warnings.push(`Telegram streamMode 可疑: ${telegramMode}`);
  } else {
    warnings.push('Telegram streamMode 未显式配置');
  }

  if (config?.channels?.telegram?.streamMode && typeof config?.channels?.telegram?.streaming === 'boolean') {
    warnings.push('Telegram 同时存在 streamMode 和 legacy streaming，容易让人误判生效项');
  }

  if (configFile.endsWith('config.json')) {
    warnings.push('当前读取的是 config.json，不是 openclaw.json；确认这是不是你真正生效的文件');
  }

  let score = 100;
  score -= bad.length * 18;
  score -= warnings.length * 6;
  if (score < 0) score = 0;

  return makeSummary('config', score, good, warnings, bad, {
    configFile,
    primaryModel,
    telegramMode,
    modelMode,
  });
}

function collectConfigReport() {
  const home = getOpenClawHome();
  const candidates = [
    path.join(home, 'openclaw.json'),
    path.join(home, 'config.json'),
  ];

  const configFile = candidates.find((p) => fs.existsSync(p));
  if (!configFile) {
    return {
      name: 'config',
      status: 'bad',
      score: 0,
      counts: { good: 0, warnings: 0, bad: 1 },
      good: [],
      warnings: [],
      bad: [`未找到 OpenClaw 配置文件（checked: ${candidates.join(', ')}）`],
      configFile: null,
      primaryModel: '(未设置)',
      telegramMode: '(未设置)',
      modelMode: '(未设置)',
    };
  }

  const config = safeReadJson(configFile);
  if (config.__error) {
    return {
      name: 'config',
      status: 'bad',
      score: 0,
      counts: { good: 0, warnings: 0, bad: 1 },
      good: [],
      warnings: [],
      bad: [`配置文件读取失败: ${config.__error}`],
      configFile,
      primaryModel: '(未设置)',
      telegramMode: '(未设置)',
      modelMode: '(未设置)',
    };
  }

  return analyzeConfig(config, configFile);
}

function printConfigReport(report) {
  console.log('🩺 Lobster Doctor · config');
  console.log(`配置文件: ${report.configFile || '(未找到)'}`);
  console.log(`主模型: ${report.primaryModel}`);
  console.log(`models.mode: ${report.modelMode}`);
  console.log(`Telegram stream: ${report.telegramMode}`);
  console.log(`配置健康分: ${report.score}/100`);
  console.log(`状态: ${report.status}`);

  printList('正常项', '✅', report.good);
  printList('提醒项', '⚠️', report.warnings);
  printList('问题项', '❌', report.bad);

  console.log('\n建议动作:');
  if (report.bad.length) console.log('- 先修 ❌ 问题项，再谈“为什么配置没生效”');
  else if (report.warnings.length) console.log('- 配置能跑，但有歧义；建议先把提醒项收口');
  else console.log('- 这份配置至少在关键入口上是清楚的，可以继续查更深层问题');
}

function runConfig(options = {}) {
  const report = collectConfigReport();
  if (options.json) return report;
  printConfigReport(report);
  return report;
}

module.exports = { runConfig, analyzeConfig, collectConfigReport };
