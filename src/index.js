require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { initDB } = require('./db/db');

// Initialize database
initDB();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessagePolls,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// Command collection
client.commands = new Collection();

// Load all commands recursively from src/commands/**/*.js
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        console.log(`[Commands] Loaded: /${command.data.name}`);
      }
    }
  }
}

loadCommands(path.join(__dirname, 'commands'));

// Load all events from src/events/*.js
const eventsDir = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(eventsDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`[Events] Loaded: ${event.name}`);
}

// Login
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('[Error] DISCORD_BOT_TOKEN is not set in .env');
  process.exit(1);
}

client.login(token).catch(err => {
  console.error('[Error] Failed to log in:', err.message);
  process.exit(1);
});
