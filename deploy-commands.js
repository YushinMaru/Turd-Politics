require('dotenv').config();
const { REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('[Deploy] DISCORD_BOT_TOKEN and CLIENT_ID must be set in .env');
  process.exit(1);
}

const commands = [];

// Recursively collect all command data objects
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.data) {
        commands.push(command.data.toJSON());
        console.log(`[Deploy] Queued: /${command.data.name}`);
      }
    }
  }
}

loadCommands(path.join(__dirname, 'src', 'commands'));

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`[Deploy] Registering ${commands.length} command(s)...`);

    let route;
    if (guildId) {
      // Guild-scoped — updates instantly (use this during development)
      route = Routes.applicationGuildCommands(clientId, guildId);
      console.log(`[Deploy] Deploying to guild ${guildId} (instant)`);
    } else {
      // Global — takes up to 1 hour to propagate
      route = Routes.applicationCommands(clientId);
      console.log('[Deploy] Deploying globally (may take up to 1 hour)');
    }

    const data = await rest.put(route, { body: commands });
    console.log(`[Deploy] Successfully registered ${data.length} command(s).`);
  } catch (err) {
    console.error('[Deploy] Error:', err);
    process.exit(1);
  }
})();
