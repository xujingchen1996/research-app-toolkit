#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  detectHosts,
  installClaudeHost,
  installCodexHost,
  installDshHost,
  parseArgs,
} from "../lib/installer.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function printHelp() {
  console.log(`科研申请工具包安装器

用法：
  ratk install
  ratk install --claude
  ratk install --codex
  ratk install --dsh
  ratk install --all

行为：
  - 无参数时安装到当前机器检测到的主机。
  - --claude 仅安装 Claude Code 插件。
  - --codex 仅安装 Codex 插件。
  - --dsh 无须 DSH 已安装，先准备预设与 UI bundle 文件。
  - --all 为已检测到的 Claude/Codex 安装，同时预安装 DSH bundle。
  - DSH 启用：在“插件 → 添加插件”中添加输出的本地目录并启用。
`);
}

async function readPackageVersion() {
  const packageJson = await readFile(path.join(packageRoot, "package.json"), "utf8");
  return JSON.parse(packageJson).version;
}

function resolveTargets(options, detected) {
  if (options.all) {
    return ["claude", "codex", "dsh"];
  }

  const explicit = [];
  if (options.claude) {
    explicit.push("claude");
  }
  if (options.codex) {
    explicit.push("codex");
  }

  if (options.dsh) {
    explicit.push("dsh");
  }

  if (explicit.length > 0) {
    return explicit;
  }

  return Object.entries(detected)
    .filter(([, present]) => present)
    .map(([host]) => host);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (options.help || command === "help") {
    printHelp();
    return;
  }

  if (command !== "install") {
    throw new Error(`Unsupported command: ${command}`);
  }

  const detected = detectHosts();
  const targets = resolveTargets(options, detected);
  const explicitSingleTarget = (options.claude || options.codex || options.dsh) && !options.all;

  if (targets.length === 0) {
    throw new Error("No supported host was detected. Install Claude Code or Codex first, or use --dsh to prepare the DSH bundle before installing DSH.");
  }

  const version = await readPackageVersion();
  const results = [];
  const skipped = [];

  for (const target of targets) {
    if (!detected[target] && target !== "dsh") {
      if (explicitSingleTarget) {
        throw new Error(`Requested host is not installed: ${target}`);
      }
      skipped.push(target);
      continue;
    }

    if (target === "claude") {
      results.push(await installClaudeHost({ sourceDir: packageRoot, version }));
      continue;
    }

    if (target === "dsh") {
      results.push(await installDshHost({ sourceDir: packageRoot, version, ...(process.env.DSH_HOME ? { dshHomeDir: process.env.DSH_HOME } : {}) }));
      continue;
    }

    if (target === "codex") {
      results.push(await installCodexHost({ sourceDir: packageRoot, version }));
    }
  }

  if (results.length === 0) {
    throw new Error("No installation was completed. The requested hosts were not detected on this machine.");
  }

  console.log("Installed Research Application Toolkit:");
  for (const result of results) {
    console.log(`- ${result.host}: ${result.pluginDir}`);
    if (result.activationRequired) {
      console.log("  DSH 文件已预安装；在 DSH 插件管理器添加此目录并启用后，选择 RA 科研申请模式。");
    }
  }

  if (skipped.length > 0) {
    console.log(`Skipped hosts not detected on this machine: ${skipped.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
