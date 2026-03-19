const { getAllOpenVoteMessages, getTally, determineWinner, awardWinnerPoints, notifySubscribers } = require('./voteService');
const { closeDebate, getDebate } = require('./debateService');
const { votePollEmbed, winnerEmbed } = require('../utils/embeds');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Map of debateId -> setTimeout handle (for clean restarts)
const activeTimers = new Map();

/**
 * Schedule the close of a vote at a specific Unix timestamp.
 */
function scheduleVoteClose(client, debateId, voteClosesAt) {
  const msLeft = (voteClosesAt * 1000) - Date.now();
  if (msLeft <= 0) {
    // Already expired — close immediately
    finalizeVote(client, debateId);
    return;
  }

  // Clear any existing timer for this debate
  if (activeTimers.has(debateId)) {
    clearTimeout(activeTimers.get(debateId));
  }

  const timer = setTimeout(() => finalizeVote(client, debateId), msLeft);
  activeTimers.set(debateId, timer);
  console.log(`[Scheduler] Vote for debate #${debateId} closes in ${Math.round(msLeft / 1000 / 60)} minutes.`);
}

/**
 * Finalize a vote: determine winner, update DB, edit the poll message, announce.
 */
async function finalizeVote(client, debateId) {
  activeTimers.delete(debateId);

  const voteMsg = require('./voteService').getVoteMessage(debateId);
  if (!voteMsg) return;

  const debate = getDebate(debateId);
  if (!debate || debate.status !== 'voting') return;

  const tally = getTally(debateId);
  const winner = determineWinner(tally);

  // Mark debate closed in DB
  closeDebate(debateId, debate.guild_id, null);

  // Award points
  awardWinnerPoints(debate, winner);

  // Edit the vote poll message to show final results
  try {
    const channel = await client.channels.fetch(voteMsg.channel_id);
    if (channel) {
      const message = await channel.messages.fetch(voteMsg.message_id);
      if (message) {
        let winnerLabel = 'No votes cast';
        if (winner === 'side_a') winnerLabel = `${debate.side_a_label} wins!`;
        else if (winner === 'side_b') winnerLabel = `${debate.side_b_label} wins!`;
        else if (winner === 'draw') winnerLabel = 'Draw!';

        const finalEmbed = winnerEmbed(debate, winnerLabel, tally);

        // Disable all buttons on the original message
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`vote_sidea_${debateId}`).setLabel(debate.side_a_label).setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId(`vote_sideb_${debateId}`).setLabel(debate.side_b_label).setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId(`vote_draw_${debateId}`).setLabel('Draw').setStyle(ButtonStyle.Secondary).setDisabled(true),
        );

        await message.edit({ embeds: [finalEmbed], components: [disabledRow] });

        // Post a winner announcement in the same channel
        await channel.send({ embeds: [finalEmbed] });
      }
    }
  } catch (err) {
    console.error(`[Scheduler] Error finalizing vote for debate #${debateId}:`, err.message);
  }

  // Try to rename the thread to reflect closed status
  try {
    if (debate.thread_id) {
      const thread = await client.channels.fetch(debate.thread_id);
      if (thread && thread.setName) {
        let suffix = 'Closed';
        if (winner === 'side_a') suffix = `${debate.side_a_label} Won`;
        else if (winner === 'side_b') suffix = `${debate.side_b_label} Won`;
        else if (winner === 'draw') suffix = 'Draw';
        await thread.setName(`[${suffix}] ${debate.topic}`.slice(0, 100));
      }
    }
  } catch {}

  // Notify subscribers
  await notifySubscribers(
    client,
    debateId,
    `Debate #${debateId} ("${debate.topic}") has concluded! Check the results in the server.`,
  );
}

/**
 * On bot startup, recover all in-progress votes and reschedule their close timers.
 */
async function recoverSchedules(client) {
  const openVotes = getAllOpenVoteMessages();
  console.log(`[Scheduler] Recovering ${openVotes.length} open vote(s)...`);
  for (const v of openVotes) {
    scheduleVoteClose(client, v.debate_id, v.vote_closes_at);
  }
}

module.exports = { scheduleVoteClose, finalizeVote, recoverSchedules };
