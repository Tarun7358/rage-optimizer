/**
 * RAGE OPTIMIZER - Bot Command Test Suite
 * Run with: node test_bot_commands.js
 * Tests all 9 registered slash commands for structure validity
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

const COMMANDS_DIR = path.join(__dirname, 'src/bot/commands');

const results = {
  loaded: [],
  failed: [],
  registered: []
};

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║   RAGE OPTIMIZER - Bot Command Test Suite    ║');
console.log('╚══════════════════════════════════════════════╝\n');

// ── STEP 1: Load & Validate command files ──
console.log('📂 Scanning command files...\n');

const folders = fs.readdirSync(COMMANDS_DIR);
for (const folder of folders) {
  const folderPath = path.join(COMMANDS_DIR, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    try {
      const cmd = require(filePath);
      if (!cmd.data || !cmd.execute) {
        results.failed.push({ file, reason: 'Missing data or execute property' });
        console.log(`  ❌ [${folder}/${file}] Missing data or execute`);
        continue;
      }
      const json = cmd.data.toJSON();
      results.loaded.push({
        name: json.name,
        description: json.description,
        folder,
        file,
        options: json.options?.length || 0,
        permissions: json.default_member_permissions || 'None'
      });
      console.log(`  ✅ /${json.name} — ${json.description}`);
      console.log(`     Category: ${folder} | Options: ${json.options?.length || 0}`);
    } catch (err) {
      results.failed.push({ file, reason: err.message });
      console.log(`  ❌ [${folder}/${file}] Load error: ${err.message}`);
    }
  }
}

// ── STEP 2: Fetch live registered commands from Discord ──
console.log('\n🌐 Fetching registered commands from Discord API...\n');

const rest = new REST().setToken(TOKEN);
(async () => {
  try {
    const discordCmds = await rest.get(Routes.applicationCommands(CLIENT_ID));
    results.registered = discordCmds;

    console.log(`  📡 Discord reports ${discordCmds.length} registered commands:`);
    discordCmds.forEach(cmd => {
      const local = results.loaded.find(c => c.name === cmd.name);
      const match = local ? '✅' : '⚠️ (no local file)';
      console.log(`     ${match} /${cmd.name} (ID: ${cmd.id})`);
    });

    // ── STEP 3: Diff check ──
    console.log('\n🔍 Cross-referencing local vs Discord...\n');

    const localNames = results.loaded.map(c => c.name);
    const discordNames = discordCmds.map(c => c.name);

    const onlyLocal = localNames.filter(n => !discordNames.includes(n));
    const onlyDiscord = discordNames.filter(n => !localNames.includes(n));

    if (onlyLocal.length > 0) {
      console.log(`  ⚠️  Local only (not yet on Discord): ${onlyLocal.join(', ')}`);
    }
    if (onlyDiscord.length > 0) {
      console.log(`  ⚠️  Discord only (stale/orphan): ${onlyDiscord.join(', ')}`);
    }
    if (onlyLocal.length === 0 && onlyDiscord.length === 0) {
      console.log('  ✅ All commands are perfectly synced!');
    }

    // ── STEP 4: Summary ──
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║                   SUMMARY                   ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Local files loaded:   ${String(results.loaded.length).padEnd(20)} ║`);
    console.log(`║  Local load failures:  ${String(results.failed.length).padEnd(20)} ║`);
    console.log(`║  Discord registered:   ${String(results.registered.length).padEnd(20)} ║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  Commands by category:                       ║');

    const byFolder = {};
    results.loaded.forEach(c => {
      byFolder[c.folder] = (byFolder[c.folder] || 0) + 1;
    });
    Object.entries(byFolder).forEach(([folder, count]) => {
      console.log(`║    ${folder.padEnd(12)}: ${String(count).padEnd(28)} ║`);
    });

    console.log('╚══════════════════════════════════════════════╝');

    if (results.failed.length === 0 && onlyLocal.length === 0 && onlyDiscord.length === 0) {
      console.log('\n🎉 ALL SYSTEMS GO — Bot commands fully operational!\n');
    } else {
      console.log('\n⚠️  Some issues found. Check the report above.\n');
    }

  } catch (err) {
    console.error('  ❌ Failed to reach Discord API:', err.message);
    console.log('\n  ℹ️  Local command validation results:');
    console.log(`     Loaded: ${results.loaded.length} | Failed: ${results.failed.length}`);
  }
})();
