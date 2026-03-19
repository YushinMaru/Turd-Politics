# Turd Politics — Full Feature Plan & TODO

## Phase 1: Core Foundation (MVP)
- [x] Project scaffolded (package.json, .env, .gitignore, CLAUDE.md)
- [x] Directory structure created
- [ ] `npm install` dependencies
- [ ] `src/db/db.js` — SQLite init, all tables created
- [ ] `src/utils/constants.js` — colors, point values, statuses, random topics list
- [ ] `src/utils/embeds.js` — reusable embed builders
- [ ] `src/utils/permissions.js` — isMod(), isDebateBanned() helpers
- [ ] `src/index.js` — client init, command loader, event loader, cron setup
- [ ] `src/events/ready.js` — on Ready, log bot info
- [ ] `src/events/interactionCreate.js` — route slash commands and button interactions
- [ ] `deploy-commands.js` — register slash commands with Discord REST API

---

## Phase 2: Debate System
- [ ] `/debate create <topic>` — Creates a Forum thread (or text thread), stores in DB, announces in debates channel
- [ ] `/debate list` — Embeds list of all open/voting debates with links
- [ ] `/debate close <id>` — Mods only: changes status to `voting`, kicks off vote
- [ ] `/debate archive <id>` — Mods only: changes status to `archived`
- [ ] `/debate flag <id>` — Any user: sends a message to mod-queue channel for review
- [ ] `/debate delete <id>` — Mods only: removes from DB and deletes thread
- [ ] `src/services/debateService.js` — createDebate(), getDebate(), listDebates(), closeDebate(), deleteDebate(), flagDebate()

---

## Phase 3: Voting System
- [ ] `/vote start <debate_id>` — Posts voting embed with Side A / Side B / Draw buttons in a results channel
- [ ] `/vote results <debate_id>` — Shows current live tally in an embed
- [ ] Button handler: `vote_sidea_<id>`, `vote_sideb_<id>`, `vote_draw_<id>` — records vote, prevents double voting
- [ ] Auto-close vote after configured duration using `node-cron`
- [ ] On vote close: announce winner, update thread title, award points to winner(s)
- [ ] `src/services/voteService.js` — startVote(), castVote(), getResults(), closeVote()
- [ ] `src/services/schedulerService.js` — startup: check all open votes, schedule any that are still running

---

## Phase 4: Reputation & Profiles
- [ ] `/leaderboard` — Top 10 debaters by points, formatted embed with medals
- [ ] `/profile [@user]` — Shows debates participated, wins, losses, points, topics created
- [ ] `src/services/reputationService.js` — addPoints(), getUser(), updateWins(), updateRoles()
- [ ] Role auto-assign logic on relevant events:
  - `Debater` — after first debate participation (+2pts trigger)
  - `Veteran Debater` — after 5th debate
  - `Champion` — after 3rd win
  - `Topic Creator` — after 5th topic created

---

## Phase 5: Server Config
- [ ] `/setup` — One-time server setup wizard:
  - Set debates channel (where new topics are announced)
  - Set results channel (where vote polls are posted)
  - Set mod-queue channel (where flags are sent)
  - Set audit-log channel (all bot actions logged here)
  - Set vote duration in hours (default: 48)
  - Set max topic length in characters (default: 200)
- [ ] `/config show` — Display current server config in an embed
- [ ] `/config set <key> <value>` — Update a single config value

---

## Phase 6: Moderation Tools
- [ ] `/ban-from-debates @user [reason]` — Prevent user from creating topics, participating, or voting
- [ ] `/unban-from-debates @user` — Lift the ban
- [ ] `/roles-sync` — Force re-evaluate and re-assign all debate roles for all members
- [ ] Audit log: bot posts a message to audit-log channel on every significant action
- [ ] `/debate flag` handling: mod-queue channel message with Approve / Dismiss buttons

---

## Phase 7: Fun / Flavor Commands
- [ ] `/bs @user` — Call out someone's argument as BS (costs 5 pts from caller, logged publicly, target can counter)
- [ ] `/flip-flop @user` — Accuse someone of changing their debate position (stored in DB, publicly displayed)
- [ ] `/podium` — Fancy embed showing top 3 debaters with gold/silver/bronze styling
- [ ] `/random-debate` — Suggests a random controversial political topic from a built-in list (100+ topics)

---

## Phase 8: Tournaments (Stretch Goal)
- [ ] `/tournament create <name>` — Mods create a named debate tournament
- [ ] `/tournament join <name>` — Users sign up before bracket is locked
- [ ] `/tournament start <name>` — Mods lock the bracket, auto-generate round 1 matchups
- [ ] `/tournament bracket <name>` — Shows current bracket state as an embed
- [ ] Auto-advance winners: after each tournament debate's vote closes, advance winner to next round
- [ ] `/tournament winner <name>` — Announce tournament champion, award special role + bonus points

---

## Phase 9: Notifications / Subscriptions
- [ ] `/subscribe <debate_id>` — User opts in to DM notifications for a debate
- [ ] `/unsubscribe <debate_id>` — Remove subscription
- [ ] DM notifications sent to subscribers when:
  - Voting opens on a debate
  - Voting closes and winner is announced
- [ ] Gracefully handle DM failures (user has DMs closed) — log and skip

---

## Database Tables Checklist
- [ ] `servers` — guild_id, debates_channel_id, results_channel_id, modqueue_channel_id, auditlog_channel_id, vote_duration_hours, max_topic_length
- [ ] `debates` — id, guild_id, topic, creator_id, thread_id, message_id, status, side_a_label, side_b_label, created_at, closed_at
- [ ] `participants` — debate_id, user_id, side (for/against/neutral), joined_at
- [ ] `votes` — id, debate_id, voter_id, vote (side_a/side_b/draw), voted_at
- [ ] `vote_messages` — debate_id, channel_id, message_id (tracks the poll embed for editing)
- [ ] `users` — guild_id, user_id, points, wins, losses, debates_participated, topics_created
- [ ] `bans` — guild_id, user_id, banned_by, reason, banned_at
- [ ] `flip_flops` — id, guild_id, accuser_id, target_id, debate_id, created_at
- [ ] `bs_calls` — id, guild_id, caller_id, target_id, debate_id, countered, created_at
- [ ] `tournaments` — id, guild_id, name, status, bracket_json, created_at
- [ ] `tournament_participants` — tournament_id, user_id, eliminated
- [ ] `subscriptions` — debate_id, user_id

---

## Slash Commands Master List
| Command | Description |
|---|---|
| `/debate create <topic>` | Create a new debate topic |
| `/debate list` | List all active debates |
| `/debate close <id>` | (Mod) Open voting on a debate |
| `/debate archive <id>` | (Mod) Archive a closed debate |
| `/debate flag <id>` | Report a debate to mods |
| `/debate delete <id>` | (Mod) Delete a debate |
| `/vote start <id>` | (Mod) Manually start a vote |
| `/vote results <id>` | Show current vote tally |
| `/leaderboard` | Top 10 debaters by points |
| `/profile [@user]` | View a user's debate profile |
| `/setup` | (Admin) Configure the bot for this server |
| `/config show` | Show server config |
| `/config set <key> <value>` | (Admin) Update a config value |
| `/ban-from-debates @user` | (Mod) Ban a user from debates |
| `/unban-from-debates @user` | (Mod) Unban a user |
| `/roles-sync` | (Mod) Re-sync all debate roles |
| `/bs @user` | Call someone's argument BS |
| `/flip-flop @user` | Accuse someone of flip-flopping |
| `/podium` | Show the top 3 debaters |
| `/random-debate` | Get a random debate topic suggestion |
| `/subscribe <id>` | Subscribe to debate notifications |
| `/unsubscribe <id>` | Unsubscribe from debate notifications |
| `/tournament create <name>` | (Mod) Create a tournament |
| `/tournament join <name>` | Join a tournament |
| `/tournament start <name>` | (Mod) Lock bracket and start |
| `/tournament bracket <name>` | Show current bracket |

---

## Bot Permissions Required
When adding the bot to a server, it needs these permissions:
- `Manage Threads` — create and manage debate forum threads
- `Manage Roles` — auto-assign reputation roles
- `Send Messages` — post in channels
- `Send Messages in Threads` — post in debate threads
- `Embed Links` — rich embeds
- `Add Reactions` — (future) reaction-based features
- `Manage Messages` — pin important messages, enforce rules
- `Read Message History` — read thread history
- `Create Public Threads` — start debate threads
- `View Channel` — see channels

## Gateway Intents Required
- `Guilds`
- `GuildMessages`
- `GuildMembers` (privileged — must be enabled in Discord Developer Portal)
- `MessageContent` (privileged — must be enabled in Discord Developer Portal)
- `GuildMessagePolls`

---

## Notes & Known Considerations
- GUILD_ID in .env should be set during dev for instant command updates (guild-scoped). Remove for production (global, takes up to 1 hour to propagate).
- Forum channels are the best UX for debates (each topic = its own thread with its own layout). If the server doesn't have Community enabled, fall back to creating threads in a text channel.
- All vote polls use Discord Buttons (not the native Poll feature) so we can store and control voting state in our DB.
- The `/setup` command must be run before the bot is usable in a server — all commands check for server config and return an error if not configured.
- Cron job on bot startup checks all `voting` debates and re-schedules their close timers in case the bot restarted mid-vote.
