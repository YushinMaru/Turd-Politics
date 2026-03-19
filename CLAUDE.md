# Turd Politics — Claude Instructions

## Project Overview
Turd Politics is a Discord bot built with **Discord.js v14** and **Node.js**. It lets any Discord user in a server create political debate topics, argue sides in threads, and have the community vote on winners. There is a reputation/points system, leaderboard, moderation tools, and fun flavor commands.

## Tech Stack
- **Runtime:** Node.js (ESM-compatible, but we use CommonJS `require`)
- **Discord Library:** discord.js v14
- **Database:** SQLite via `better-sqlite3` (synchronous API — no promises needed for DB calls)
- **Scheduler:** `node-cron` for auto-closing votes after their duration expires
- **Config:** `.env` loaded via `dotenv`

## Project Structure
```
src/
  commands/         Slash commands, organized by category folder
    debate/         create, list, close, archive, flag, delete
    vote/           start, results
    profile/        leaderboard, profile
    config/         setup, show, set
    moderation/     ban, roles-sync
    fun/            bs, flip-flop, podium, random-debate
    tournament/     create, join, bracket
  events/           Discord event handlers (ready, interactionCreate, etc.)
  services/         Business logic (debateService, voteService, reputationService, schedulerService)
  db/               Database init and schema
  utils/            Shared helpers (embeds, permissions, constants)
  index.js          Main entry point
deploy-commands.js  Registers slash commands with Discord API
```

## Key Conventions
- Every command file must export: `{ data, execute }` where `data` is a `SlashCommandBuilder` and `execute` is `async (interaction) => {}`.
- Commands are auto-loaded in `index.js` by recursively reading `src/commands/**/*.js`.
- All DB calls use the synchronous `better-sqlite3` API — no `await` needed.
- Use `interaction.reply({ embeds: [...], ephemeral: true })` for errors/confirmations only the user should see.
- Use `interaction.reply({ embeds: [...] })` for public responses.
- Embeds are built in `src/utils/embeds.js` — always use those helpers, don't build raw embed objects in commands.
- Permission checks live in `src/utils/permissions.js`.
- All string constants (colors, point values, status names) live in `src/utils/constants.js`.

## Database
- DB file: `turd_politics.db` at the project root (gitignored).
- Schema is initialized in `src/db/db.js` — tables are created with `CREATE TABLE IF NOT EXISTS`.
- Never use raw user input in SQL — always use prepared statements (`db.prepare(...).run(...)`).

## Environment Variables
- `DISCORD_BOT_TOKEN` — bot token (never commit this)
- `CLIENT_ID` — bot application ID (safe to commit, but kept in .env for consistency)
- `GUILD_ID` — optional; if set, commands are deployed to this guild only (faster for dev). Leave blank for global.
- `DB_PATH` — path to SQLite file (default: `./turd_politics.db`)

## Running the Bot
```bash
npm install          # Install dependencies
npm run deploy       # Register slash commands with Discord
npm start            # Start the bot
```

## Adding a New Command
1. Create `src/commands/<category>/<name>.js`
2. Export `{ data, execute }` following existing command patterns
3. Run `npm run deploy` to register the new command with Discord

## Points System
- Create a debate topic: **+5 pts**
- Participate in a debate: **+2 pts**
- Win a community vote: **+15 pts**
- Call BS on someone (costs): **-5 pts**

## Debate Statuses
- `open` — accepting arguments in thread
- `voting` — vote poll is live, no new arguments
- `closed` — voting ended, winner announced
- `archived` — moved to archive by moderator

## Role Thresholds
- `Debater` — participated in 1+ debates
- `Veteran Debater` — 5+ debates
- `Champion` — 3+ debate wins
- `Topic Creator` — created 5+ debate topics
