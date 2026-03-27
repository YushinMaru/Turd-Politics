const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../db/db');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed } = require('../../utils/embeds');
const { COLORS } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-stats')
    .setDescription('Show overall debate statistics for this server'),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const g = interaction.guildId;

    const totalDebates   = db.prepare("SELECT COUNT(*) as c FROM debates WHERE guild_id = ?").get(g)?.c || 0;
    const openDebates    = db.prepare("SELECT COUNT(*) as c FROM debates WHERE guild_id = ? AND status = 'open'").get(g)?.c || 0;
    const votingDebates  = db.prepare("SELECT COUNT(*) as c FROM debates WHERE guild_id = ? AND status = 'voting'").get(g)?.c || 0;
    const closedDebates  = db.prepare("SELECT COUNT(*) as c FROM debates WHERE guild_id = ? AND status IN ('closed','archived')").get(g)?.c || 0;
    const totalVotes     = db.prepare("SELECT COUNT(*) as c FROM votes WHERE debate_id IN (SELECT id FROM debates WHERE guild_id = ?)").get(g)?.c || 0;
    const totalBsCalls   = db.prepare("SELECT COUNT(*) as c FROM bs_calls WHERE guild_id = ?").get(g)?.c || 0;
    const totalFlipFlops = db.prepare("SELECT COUNT(*) as c FROM flip_flops WHERE guild_id = ?").get(g)?.c || 0;
    const totalDebaters  = db.prepare("SELECT COUNT(*) as c FROM users WHERE guild_id = ? AND debates_participated > 0").get(g)?.c || 0;
    const totalPoints    = db.prepare("SELECT SUM(points) as s FROM users WHERE guild_id = ?").get(g)?.s || 0;

    // Most active debater
    const topDebater = db.prepare("SELECT user_id, debates_participated FROM users WHERE guild_id = ? ORDER BY debates_participated DESC LIMIT 1").get(g);
    // Most BS-called target
    const mostBsd = db.prepare("SELECT target_id, COUNT(*) as c FROM bs_calls WHERE guild_id = ? GROUP BY target_id ORDER BY c DESC LIMIT 1").get(g);
    // Hottest debate (most participants)
    const hottestDebate = db.prepare(`
      SELECT d.id, d.topic, COUNT(p.user_id) as participant_count
      FROM debates d LEFT JOIN participants p ON p.debate_id = d.id
      WHERE d.guild_id = ?
      GROUP BY d.id ORDER BY participant_count DESC LIMIT 1
    `).get(g);

    const embed = new EmbedBuilder()
      .setColor(COLORS.TOURNAMENT)
      .setTitle(`📊 ${interaction.guild.name} — Debate Stats`)
      .addFields(
        { name: '💬 Total Debates', value: `${totalDebates}`, inline: true },
        { name: '🟢 Open', value: `${openDebates}`, inline: true },
        { name: '🗳️ In Voting', value: `${votingDebates}`, inline: true },
        { name: '🔒 Closed/Archived', value: `${closedDebates}`, inline: true },
        { name: '🗳️ Total Votes Cast', value: `${totalVotes}`, inline: true },
        { name: '👥 Active Debaters', value: `${totalDebaters}`, inline: true },
        { name: '💩 BS Calls Thrown', value: `${totalBsCalls}`, inline: true },
        { name: '🔄 Flip-Flop Accusations', value: `${totalFlipFlops}`, inline: true },
        { name: '⭐ Total Points in Circulation', value: `${totalPoints}`, inline: true },
      );

    if (topDebater) {
      embed.addFields({ name: '🏅 Most Active Debater', value: `<@${topDebater.user_id}> (${topDebater.debates_participated} debates)`, inline: true });
    }
    if (mostBsd) {
      embed.addFields({ name: '💩 Most BS\'d Person', value: `<@${mostBsd.target_id}> (${mostBsd.c} times)`, inline: true });
    }
    if (hottestDebate && hottestDebate.participant_count > 0) {
      embed.addFields({ name: '🔥 Hottest Debate', value: `**#${hottestDebate.id}** ${hottestDebate.topic}\n${hottestDebate.participant_count} participants`, inline: false });
    }

    embed.setTimestamp().setFooter({ text: 'Turd Politics Stats' });

    return interaction.reply({ embeds: [embed] });
  },
};
