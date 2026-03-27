const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('./constants');

/**
 * Standard error embed
 */
function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle('Error')
    .setDescription(message);
}

/**
 * Standard success embed
 */
function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(title)
    .setDescription(description);
}

/**
 * Debate announcement embed (posted when a new debate is created)
 */
function debateAnnouncementEmbed(debate, creator) {
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('New Debate Topic!')
    .setDescription(`**${debate.topic}**`)
    .addFields(
      { name: 'Created by', value: `<@${creator.id}>`, inline: true },
      { name: 'Debate ID', value: `#${debate.id}`, inline: true },
      { name: 'Status', value: 'Open for arguments', inline: true },
    )
    .setFooter({ text: 'Jump into the thread to argue your side!' })
    .setTimestamp();
}

/**
 * Debate list embed
 */
function debateListEmbed(debates) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('Active Debates')
    .setTimestamp();

  if (!debates || debates.length === 0) {
    embed.setDescription('No active debates right now. Use `/debate create` to start one!');
    return embed;
  }

  const lines = debates.map(d => {
    const statusEmoji = d.status === 'voting' ? '🗳️' : '💬';
    const link = d.thread_id ? ` — [Jump in](https://discord.com/channels/${d.guild_id}/${d.thread_id})` : '';
    return `${statusEmoji} **#${d.id}** ${d.topic}${link}`;
  });

  embed.setDescription(lines.join('\n'));
  embed.setFooter({ text: `${debates.length} debate(s) active` });
  return embed;
}

/**
 * Vote poll embed (posted when voting starts)
 */
function votePollEmbed(debate, tally) {
  const sideA = tally?.side_a || 0;
  const sideB = tally?.side_b || 0;
  const draw = tally?.draw || 0;
  const total = sideA + sideB + draw;

  const bar = (count) => {
    if (total === 0) return '░░░░░░░░░░ 0%';
    const pct = Math.round((count / total) * 100);
    const filled = Math.round(pct / 10);
    return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${pct}%`;
  };

  return new EmbedBuilder()
    .setColor(COLORS.VOTE)
    .setTitle(`Vote Now! — Debate #${debate.id}`)
    .setDescription(`**${debate.topic}**`)
    .addFields(
      { name: `✅ ${debate.side_a_label} (${sideA} votes)`, value: bar(sideA) },
      { name: `❌ ${debate.side_b_label} (${sideB} votes)`, value: bar(sideB) },
      { name: `🤝 Draw (${draw} votes)`, value: bar(draw) },
    )
    .setFooter({ text: `${total} total vote(s) cast — Vote using the buttons below!` })
    .setTimestamp();
}

/**
 * Winner announcement embed
 */
function winnerEmbed(debate, winnerLabel, tally) {
  const total = (tally.side_a || 0) + (tally.side_b || 0) + (tally.draw || 0);
  return new EmbedBuilder()
    .setColor(COLORS.WINNER)
    .setTitle('Debate Concluded!')
    .setDescription(`**${debate.topic}**`)
    .addFields(
      { name: 'Winner', value: `🏆 **${winnerLabel}**`, inline: true },
      { name: 'Total Votes', value: `${total}`, inline: true },
      { name: 'For', value: `${tally.side_a || 0}`, inline: true },
      { name: 'Against', value: `${tally.side_b || 0}`, inline: true },
      { name: 'Draw', value: `${tally.draw || 0}`, inline: true },
    )
    .setFooter({ text: `Debate #${debate.id}` })
    .setTimestamp();
}

/**
 * Leaderboard embed
 */
function leaderboardEmbed(rows, guild) {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) => {
    const medal = medals[i] || `${i + 1}.`;
    return `${medal} <@${r.user_id}> — **${r.points} pts** (${r.wins}W / ${r.losses}L)`;
  });

  return new EmbedBuilder()
    .setColor(COLORS.WINNER)
    .setTitle('Turd Politics Leaderboard')
    .setDescription(lines.join('\n') || 'No data yet.')
    .setTimestamp();
}

/**
 * Profile embed
 */
function profileEmbed(member, userData, rank = null, bsReceived = 0, bsThrown = 0, flipFlops = 0) {
  const total = userData.wins + userData.losses + userData.draws;
  const winRate = total > 0 ? `${Math.round((userData.wins / total) * 100)}%` : 'N/A';

  const embed = new EmbedBuilder()
    .setColor(COLORS.PROFILE)
    .setTitle(`${member.displayName}'s Debate Profile`)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: '⭐ Points', value: `${userData.points}`, inline: true },
      { name: '🏆 Rank', value: rank !== null ? `#${rank}` : '—', inline: true },
      { name: '📊 Win Rate', value: winRate, inline: true },
      { name: '✅ Wins', value: `${userData.wins}`, inline: true },
      { name: '❌ Losses', value: `${userData.losses}`, inline: true },
      { name: '🤝 Draws', value: `${userData.draws}`, inline: true },
      { name: '💬 Debates Joined', value: `${userData.debates_participated}`, inline: true },
      { name: '📝 Topics Created', value: `${userData.topics_created}`, inline: true },
      { name: '💩 BS Received', value: `${bsReceived}`, inline: true },
      { name: '💩 BS Thrown', value: `${bsThrown}`, inline: true },
      { name: '🔄 Flip-Flop Accusations', value: `${flipFlops}`, inline: true },
    )
    .setTimestamp();

  return embed;
}

/**
 * Podium embed (top 3 only, fancy)
 */
function podiumEmbed(top3) {
  const [first, second, third] = top3;
  let desc = '';
  if (first) desc += `🥇 **1st Place** — <@${first.user_id}>\n${first.points} pts | ${first.wins} wins\n\n`;
  if (second) desc += `🥈 **2nd Place** — <@${second.user_id}>\n${second.points} pts | ${second.wins} wins\n\n`;
  if (third) desc += `🥉 **3rd Place** — <@${third.user_id}>\n${third.points} pts | ${third.wins} wins`;

  return new EmbedBuilder()
    .setColor(COLORS.WINNER)
    .setTitle('The Turd Politics Podium')
    .setDescription(desc || 'Not enough debaters yet!')
    .setTimestamp();
}

/**
 * Config display embed
 */
function configEmbed(config) {
  const autoDebate = config.auto_debate_interval_days > 0
    ? `Every ${config.auto_debate_interval_days} day(s)`
    : 'Disabled';
  const autoClose = config.auto_close_days > 0
    ? `After ${config.auto_close_days} day(s)`
    : 'Disabled';

  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('Server Config — Turd Politics')
    .addFields(
      { name: 'Debates Channel', value: config.debates_channel_id ? `<#${config.debates_channel_id}>` : 'Not set', inline: true },
      { name: 'Results Channel', value: config.results_channel_id ? `<#${config.results_channel_id}>` : 'Not set', inline: true },
      { name: 'Mod Queue Channel', value: config.modqueue_channel_id ? `<#${config.modqueue_channel_id}>` : 'Not set', inline: true },
      { name: 'Audit Log Channel', value: config.auditlog_channel_id ? `<#${config.auditlog_channel_id}>` : 'Not set', inline: true },
      { name: 'Vote Duration', value: `${config.vote_duration_hours} hours`, inline: true },
      { name: 'Max Topic Length', value: `${config.max_topic_length} characters`, inline: true },
      { name: '🤖 Auto-Post Bot Debate', value: autoDebate, inline: true },
      { name: '⏰ Auto-Close Stale Debates', value: autoClose, inline: true },
    )
    .setTimestamp();
}

/**
 * BS call embed
 */
function bsEmbed(caller, target, debateId) {
  return new EmbedBuilder()
    .setColor(COLORS.FUN)
    .setTitle('BS Called!')
    .setDescription(`<@${caller.id}> is calling BS on <@${target.id}>${debateId ? ` in debate #${debateId}` : ''}!`)
    .setFooter({ text: 'The community will decide if this argument is BS.' })
    .setTimestamp();
}

/**
 * Flip-flop accusation embed
 */
function flipFlopEmbed(accuser, target, debateId) {
  return new EmbedBuilder()
    .setColor(COLORS.FUN)
    .setTitle('Flip-Flopper Alert!')
    .setDescription(`<@${accuser.id}> accuses <@${target.id}> of flip-flopping${debateId ? ` on debate #${debateId}` : ''}!`)
    .setTimestamp();
}

/**
 * Tournament bracket embed
 */
function tournamentEmbed(tournament, participants) {
  const bracket = JSON.parse(tournament.bracket_json || '{}');
  const participantList = participants.map(p => `• <@${p.user_id}>${p.eliminated ? ' ~~(eliminated)~~' : ''}`).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.TOURNAMENT)
    .setTitle(`Tournament: ${tournament.name}`)
    .addFields(
      { name: 'Status', value: tournament.status, inline: true },
      { name: 'Round', value: `${tournament.current_round}`, inline: true },
      { name: 'Participants', value: participantList || 'None yet', inline: false },
    )
    .setTimestamp();
}

/**
 * Mod flag notification embed
 */
function flagEmbed(debate, reporter) {
  return new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle('Debate Flagged for Review')
    .setDescription(`Debate **#${debate.id}** has been flagged by <@${reporter.id}>`)
    .addFields({ name: 'Topic', value: debate.topic })
    .setTimestamp();
}

module.exports = {
  errorEmbed,
  successEmbed,
  debateAnnouncementEmbed,
  debateListEmbed,
  votePollEmbed,
  winnerEmbed,
  leaderboardEmbed,
  profileEmbed,
  podiumEmbed,
  configEmbed,
  bsEmbed,
  flipFlopEmbed,
  tournamentEmbed,
  flagEmbed,
};
