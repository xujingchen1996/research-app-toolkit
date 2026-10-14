import { existsSync } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import path from "node:path";

export const PLUGIN_NAME = "research-app-toolkit";
export const CODEX_MARKETPLACE_NAME = "xujingchen1996-local";
export const CLAUDE_MARKETPLACE_NAME = "local";

const IGNORE_NAMES = new Set([".git", ".agentdocs", "node_modules", ".DS_Store"]);

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function pathExists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function shouldCopy(copyPath) {
  const baseName = path.basename(copyPath);
  return !IGNORE_NAMES.has(baseName);
}

async function replaceDirectory(sourceDir, targetDir) {
  const resolvedSource = path.resolve(sourceDir);
  const resolvedTarget = path.resolve(targetDir);

  if (resolvedSource === resolvedTarget) {
    return { pluginDir: targetDir, backupDir: null, reusedExistingDirectory: true };
  }

  let backupDir = null;
  if (await pathExists(targetDir)) {
    backupDir = `${targetDir}.bak-${timestamp()}`;
    await rm(backupDir, { recursive: true, force: true });
    await rename(targetDir, backupDir);
  }

  await mkdir(path.dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: shouldCopy,
    verbatimSymlinks: true,
  });

  return { pluginDir: targetDir, backupDir, reusedExistingDirectory: false };
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function parseArgs(argv) {
  const [command = "help", ...flags] = argv;
  const options = {
    claude: false,
    codex: false,
    dsh: false,
    all: false,
    help: false,
  };

  for (const flag of flags) {
    if (flag === "--claude") {
      options.claude = true;
      continue;
    }
    if (flag === "--codex") {
      options.codex = true;
      continue;
    }
    if (flag === "--dsh") {
      options.dsh = true;
      continue;
    }
    if (flag === "--all") {
      options.all = true;
      continue;
    }
    if (flag === "--help" || flag === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unsupported flag: ${flag}`);
  }

  return { command, options };
}

export function detectHosts(homeDir = homedir()) {
  return {
    claude: existsSync(path.join(homeDir, ".claude")),
    codex: existsSync(path.join(homeDir, ".codex")),
    dsh: existsSync(path.join(homeDir, ".dsh")),
  };
}

export function upsertClaudeMarketplace(text, version) {
  const marketplace = text
    ? JSON.parse(text)
    : {
        $schema: "https://anthropic.com/claude-code/marketplace.schema.json",
        name: CLAUDE_MARKETPLACE_NAME,
        description: "Local plugins maintained on this machine",
        owner: {
          name: userInfo().username,
        },
        plugins: [],
      };

  if (!Array.isArray(marketplace.plugins)) {
    marketplace.plugins = [];
  }

  const pluginEntry = {
    name: PLUGIN_NAME,
    description:
      "Research application toolkit for PhD, MRes, MPhil applications - CV analysis, professor matching, cold email optimization, document assistance, school selection, interview prep, and research gap analysis",
    version,
    author: {
      name: "Jingchen Xu",
    },
    source: `./${PLUGIN_NAME}`,
  };

  const existingIndex = marketplace.plugins.findIndex((plugin) => plugin.name === PLUGIN_NAME);
  if (existingIndex >= 0) {
    marketplace.plugins[existingIndex] = pluginEntry;
  } else {
    marketplace.plugins.push(pluginEntry);
  }

  return formatJson(marketplace);
}

export function upsertCodexMarketplace(text) {
  const marketplace = text
    ? JSON.parse(text)
    : {
        name: CODEX_MARKETPLACE_NAME,
        interface: {
          displayName: "Xujingchen1996 Local",
        },
        plugins: [],
      };

  if (!marketplace.interface) {
    marketplace.interface = {
      displayName: "Xujingchen1996 Local",
    };
  }

  if (!Array.isArray(marketplace.plugins)) {
    marketplace.plugins = [];
  }

  const pluginEntry = {
    name: PLUGIN_NAME,
    source: {
      source: "local",
      path: `./plugins/${PLUGIN_NAME}`,
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    },
    category: "Research",
  };

  const existingIndex = marketplace.plugins.findIndex((plugin) => plugin.name === PLUGIN_NAME);
  if (existingIndex >= 0) {
    marketplace.plugins[existingIndex] = pluginEntry;
  } else {
    marketplace.plugins.push(pluginEntry);
  }

  return formatJson(marketplace);
}

export function ensureCodexPluginEnabled(text) {
  const sectionHeader = `[plugins."${PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}"]`;
  const enabledLine = "enabled = true";
  const currentText = text ?? "";
  const lines = currentText.split("\n");
  const sectionStart = lines.findIndex((line) => line.trim() === sectionHeader);

  if (sectionStart >= 0) {
    let sectionEnd = lines.length;
    for (let index = sectionStart + 1; index < lines.length; index += 1) {
      if (lines[index].startsWith("[")) {
        sectionEnd = index;
        break;
      }
    }

    const sectionLines = lines.slice(sectionStart, sectionEnd);
    const enabledIndex = sectionLines.findIndex((line, index) => index > 0 && /^enabled\s*=/.test(line));

    if (enabledIndex >= 0) {
      sectionLines[enabledIndex] = enabledLine;
    } else {
      sectionLines.push(enabledLine);
    }

    const merged = [
      ...lines.slice(0, sectionStart),
      ...sectionLines,
      ...lines.slice(sectionEnd),
    ].join("\n");

    return `${merged.replace(/\n+$/, "")}\n`;
  }

  const trimmed = currentText.trimEnd();
  if (!trimmed) {
    return `${sectionHeader}\n${enabledLine}\n`;
  }

  return `${trimmed}\n\n${sectionHeader}\n${enabledLine}\n`;
}

async function ensureCodexCacheLink(pluginDir, homeDir) {
  const cacheRoot = path.join(homeDir, ".codex", "plugins", "cache", CODEX_MARKETPLACE_NAME);
  const cacheLinkPath = path.join(cacheRoot, PLUGIN_NAME);

  await mkdir(cacheRoot, { recursive: true });
  await rm(cacheLinkPath, { recursive: true, force: true });
  await symlink(pluginDir, cacheLinkPath, process.platform === "win32" ? "junction" : "dir");

  return cacheLinkPath;
}

export async function installClaudeHost({ sourceDir, version, homeDir = homedir() }) {
  const pluginsRoot = path.join(homeDir, ".claude", "plugins", "local");
  const pluginDir = path.join(pluginsRoot, PLUGIN_NAME);
  const marketplaceDir = path.join(pluginsRoot, ".claude-plugin");
  const marketplacePath = path.join(marketplaceDir, "marketplace.json");

  const copyResult = await replaceDirectory(sourceDir, pluginDir);
  await mkdir(marketplaceDir, { recursive: true });
  const currentMarketplace = await readTextIfExists(marketplacePath);
  await writeFile(marketplacePath, upsertClaudeMarketplace(currentMarketplace, version), "utf8");

  return {
    host: "claude",
    pluginDir: copyResult.pluginDir,
    backupDir: copyResult.backupDir,
    marketplacePath,
  };
}

export async function installCodexHost({ sourceDir, version: _version, homeDir = homedir() }) {
  const agentsRoot = path.join(homeDir, ".agents", "plugins");
  const pluginDir = path.join(agentsRoot, "plugins", PLUGIN_NAME);
  const marketplacePath = path.join(agentsRoot, "marketplace.json");
  const configPath = path.join(homeDir, ".codex", "config.toml");

  const copyResult = await replaceDirectory(sourceDir, pluginDir);
  await mkdir(path.dirname(marketplacePath), { recursive: true });
  const currentMarketplace = await readTextIfExists(marketplacePath);
  await writeFile(marketplacePath, upsertCodexMarketplace(currentMarketplace), "utf8");

  await mkdir(path.dirname(configPath), { recursive: true });
  const currentConfig = await readTextIfExists(configPath);
  await writeFile(configPath, ensureCodexPluginEnabled(currentConfig), "utf8");

  const cacheLinkPath = await ensureCodexCacheLink(copyResult.pluginDir, homeDir);

  return {
    host: "codex",
    pluginDir: copyResult.pluginDir,
    backupDir: copyResult.backupDir,
    marketplacePath,
    configPath,
    cacheLinkPath,
  };
}

// 无须 DSH 已安装：只准备 bundle 文件，profile 注册由 DSH 插件管理器完成。
export async function installDshHost({ sourceDir, version: _version, homeDir = homedir(), dshHomeDir = path.join(homeDir, ".dsh") }) {
  const pluginDir = path.join(dshHomeDir, "bundles", PLUGIN_NAME);
  const copyResult = await replaceDirectory(sourceDir, pluginDir);
  return {
    host: "dsh",
    pluginDir: copyResult.pluginDir,
    backupDir: copyResult.backupDir,
    activationRequired: true,
  };
}
