/**
 * autoDebateService.js
 *
 * Handles fully automated debate lifecycle:
 *   1. Every N days: pick a fresh topic (current events or random), post it as a new bot debate
 *   2. When posting a new bot debate: move the previous bot debate to voting automatically
 *   3. Every hour: auto-move stale user debates (open > auto_close_days) to voting
 *   4. Vote finalization is already handled by schedulerService
 */

const cron = require('node-cron');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js');
const { db } = require('../db/db');
const { createDebate, setDebateThread, getDebate, openVoting } = require('./debateService');
const { saveVoteMessage, notifySubscribers } = require('./voteService');
const { scheduleVoteClose } = require('./schedulerService');
const { researchTopic } = require('./researchService');
const { debateAnnouncementEmbed, votePollEmbed } = require('../utils/embeds');
const { RANDOM_TOPICS } = require('../utils/constants');

// ── Topic Selection ───────────────────────────────────────────────────────────

/**
 * Try to get a fresh current-events topic from Google News.
 * Falls back to null if unavailable.
 */
async function fetchCurrentEventsTopic() {
  const feeds = [
    'https://news.google.com/rss/search?q=politics+US+policy&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZxYVdjU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', // Politics topic
  ];

  for (const url of feeds) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'TurdPoliticsBot/1.0' }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;

      const headlines = [];
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const titleMatch = titleRegex.exec(match[1]);
        const raw = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
        // Strip "- Source Name" suffix and skip overly short headlines
        const clean = raw.replace(/ - [^-]+$/, '').trim();
        if (clean.length > 20 && clean.length < 180) headlines.push(clean);
        if (headlines.length >= 20) break;
      }

      if (headlines.length === 0) continue;

      // Convert headline to debate-style question
      const headline = headlines[Math.floor(Math.random() * headlines.length)];
      return `What's your take on: ${headline}?`;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Pick a topic: try current events first, then fall back to random pre-set topic.
 * Avoids repeating the last few topics by checking recent bot debates.
 */
async function pickTopic(guildId) {
  // Try current events
  const liveTopic = await fetchCurrentEventsTopic();
  if (liveTopic) return liveTopic;

  // Fall back to random topic, avoiding recently used ones
  const recentTopics = db.prepare(
    "SELECT topic FROM debates WHERE guild_id = ? AND is_bot_debate = 1 ORDER BY created_at DESC LIMIT 20",
  ).all(guildId).map(r => r.topic);

  const available = RANDOM_TOPICS.filter(t => !recentTopics.includes(t));
  const pool = available.length > 0 ? available : RANDOM_TOPICS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Core Automation ───────────────────────────────────────────────────────────

/**
 * Move a debate to voting and post the vote poll. Used for both auto-close
 * of the previous bot debate and stale user debate cleanup.
 */
async function moveToVoting(client, debate, config) {
  try {
    const updated = openVoting(debate.id, debate.guild_id, client.user.id);
    const voteClosesAt = Math.floor(Date.now() / 1000) + (config.vote_duration_hours * 3600);

    const tally = { side_a: 0, side_b: 0, draw: 0 };
    const pollEmbed = votePollEmbed(updated, tally);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`vote_sidea_${debate.id}`).setLabel(updated.side_a_label).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`vote_sideb_${debate.id}`).setLabel(updated.side_b_label).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`vote_draw_${debate.id}`).setLabel('Draw').setStyle(ButtonStyle.Secondary),
    );

    const resultsChannel = await client.channels.fetch(config.results_channel_id);
    const label = debate.is_bot_debate ? '🤖 Auto-closed' : '⏰ Auto-closed (stale)';
    const pollMessage = await resultsChannel.send({
      content: `${label} — Voting now open for Debate #${debate.id}! Closes <t:${voteClosesAt}:R>`,
      embeds: [pollEmbed],
      components: [row],
    });

    saveVoteMessage(debate.id, resultsChannel.id, pollMessage.id, voteClosesAt);
    scheduleVoteClose(client, debate.id, voteClosesAt);

    // Notify the thread
    if (updated.thread_id) {
      const thread = await client.channels.fetch(updated.thread_id).catch(() => null);
      if (thread) {
        await thread.send(`🗳️ **Voting is now open!** Head to <#${resultsChannel.id}> to vote. Closes <t:${voteClosesAt}:R>.`).catch(() => {});
      }
    }

    // DM subscribers
    notifySubscribers(
      client,
      debate.id,
      `🗳️ Voting opened for Debate #${debate.id}: **"${debate.topic}"**! Closes <t:${voteClosesAt}:R>. Head to the server to vote!`,
    ).catch(() => {});

    console.log(`[AutoDebate] Moved debate #${debate.id} to voting.`);
  } catch (err) {
    console.error(`[AutoDebate] Failed to move debate #${debate.id} to voting:`, err.message);
  }
}

/**
 * Post a new bot-created debate to the debates channel.
 */
async function postBotDebate(client, config, guildId) {
  const topic = await pickTopic(guildId);
  const guild = await client.guilds.fetch(guildId);

  // Create in DB (creator_id = bot's own user ID, flagged as bot debate)
  const debate = createDebate(guildId, topic, client.user.id);
  db.prepare('UPDATE debates SET is_bot_debate = 1 WHERE id = ?').run(debate.id);

  const embed = debateAnnouncementEmbed(debate, client.user);

  // Override the embed footer for bot debates
  const botEmbed = EmbedBuilder.from(embed)
    .setTitle('🤖 Bot Debate of the Day!')
    .setFooter({ text: 'This topic was auto-posted by the bot. Jump in and argue your side!' });

  const subscribeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`subscribe_${debate.id}`)
      .setLabel('Subscribe to Notifications')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔔'),
  );

  try {
    const debatesChannel = await client.channels.fetch(config.debates_channel_id);

    if (debatesChannel.type === ChannelType.GuildForum) {
      const thread = await debatesChannel.threads.create({
        name: topic.slice(0, 100),
        message: { embeds: [botEmbed], components: [subscribeRow] },
      });
      setDebateThread(debate.id, thread.id, thread.id);
    } else {
      const msg = await debatesChannel.send({ embeds: [botEmbed], components: [subscribeRow] });
      const thread = await msg.startThread({
        name: `[Bot Debate #${debate.id}] ${topic}`.slice(0, 100),
        autoArchiveDuration: 10080,
      });
      setDebateThread(debate.id, thread.id, msg.id);

      // Post research in the thread
      researchTopic(topic).then(async ({ wiki, news }) => {
        if (!wiki && news.length === 0) return;
        const embeds = [];
        if (wiki?.summary) {
          embeds.push(new EmbedBuilder()
            .setColor(0x6B8EAD)
            .setTitle(`📖 Wikipedia: ${wiki.title}`)
            .setDescription(wiki.summary.slice(0, 800) + (wiki.summary.length >= 800 ? '...' : ''))
            .setURL(wiki.url || null)
            .setThumbnail(wiki.thumbnail || null)
            .setFooter({ text: 'Source: Wikipedia' }));
        }
        if (news.length > 0) {
          embeds.push(new EmbedBuilder()
            .setColor(0xE8A838)
            .setTitle('📰 Recent News')
            .setDescription(news.map(a => `• [${a.title}](${a.url})${a.source ? ` — *${a.source}*` : ''}`).join('\n'))
            .setFooter({ text: 'Source: Google News' }));
        }
        const m = await thread.send({ content: '**📚 Research & Background Info:**', embeds }).catch(() => null);
        if (m) await m.pin().catch(() => {});
      }).catch(() => {});
    }

    // Update last_bot_debate_at
    db.prepare('UPDATE servers SET last_bot_debate_at = ? WHERE guild_id = ?')
      .run(Math.floor(Date.now() / 1000), guildId);

    console.log(`[AutoDebate] Posted bot debate #${debate.id} for guild ${guildId}: "${topic}"`);
  } catch (err) {
    console.error(`[AutoDebate] Failed to post bot debate for guild ${guildId}:`, err.message);
  }
}

// ── Main Tick ─────────────────────────────────────────────────────────────────

/**
 * Run once per hour. Checks every configured guild and:
 *   a) Posts a new bot debate if interval has elapsed
 *   b) Moves the previous bot debate to voting when posting a new one
 *   c) Auto-closes stale user-created debates that have been open too long
 */
async function tick(client) {
  const now = Math.floor(Date.now() / 1000);
  const guilds = db.prepare('SELECT * FROM servers WHERE debates_channel_id IS NOT NULL AND results_channel_id IS NOT NULL').all();

  for (const config of guilds) {
    // ── A: Auto-post new bot debate ──────────────────────────────────────────
    if (config.auto_debate_interval_days > 0) {
      const intervalSecs = config.auto_debate_interval_days * 86400;
      const lastPosted = config.last_bot_debate_at || 0;
      const due = (now - lastPosted) >= intervalSecs;

      if (due) {
        // Before posting: move the current active bot debate to voting
        const prevBotDebate = db.prepare(
          "SELECT * FROM debates WHERE guild_id = ? AND is_bot_debate = 1 AND status = 'open' ORDER BY created_at DESC LIMIT 1",
        ).get(config.guild_id);

        if (prevBotDebate) {
          await moveToVoting(client, prevBotDebate, config);
        }

        await postBotDebate(client, config, config.guild_id);
      }
    }

    // ── B: Auto-close stale user debates ────────────────────────────────────
    if (config.auto_close_days > 0) {
      const staleCutoff = now - (config.auto_close_days * 86400);
      const staleDebates = db.prepare(`
        SELECT * FROM debates
        WHERE guild_id = ? AND status = 'open' AND is_bot_debate = 0 AND created_at < ?
      `).all(config.guild_id, staleCutoff);

      for (const debate of staleDebates) {
        console.log(`[AutoDebate] Auto-closing stale debate #${debate.id} for guild ${config.guild_id}`);
        await moveToVoting(client, debate, config);
      }
    }
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

/**
 * Start the auto-debate cron job. Runs every hour.
 */
function startAutoDebate(client) {
  // Run immediately on startup to catch anything missed during downtime
  tick(client).catch(err => console.error('[AutoDebate] Startup tick error:', err.message));

  // Then run every hour
  cron.schedule('0 * * * *', () => {
    tick(client).catch(err => console.error('[AutoDebate] Cron tick error:', err.message));
  });

  console.log('[AutoDebate] Scheduler started (runs every hour).');
}

module.exports = { startAutoDebate };
