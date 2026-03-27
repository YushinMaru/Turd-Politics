const { SlashCommandBuilder } = require('discord.js');
const { getUser, getLeaderboard } = require('../../services/reputationService');
const { db } = require('../../db/db');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, profileEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a user\'s debate profile')
    .addUserOption(o => o.setName('user').setDescription('User to look up (defaults to yourself)')),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ embeds: [errorEmbed('Could not find that member.')], ephemeral: true });

    const userData = getUser(interaction.guildId, target.id);

    // Calculate rank (position on leaderboard)
    const rankRow = db.prepare(`
      SELECT COUNT(*) + 1 as rank FROM users
      WHERE guild_id = ? AND points > (SELECT points FROM users WHERE guild_id = ? AND user_id = ?)
    `).get(interaction.guildId, interaction.guildId, target.id);
    const rank = rankRow?.rank || 1;

    // BS calls received and given
    const bsReceived = db.prepare('SELECT COUNT(*) as c FROM bs_calls WHERE guild_id = ? AND target_id = ?').get(interaction.guildId, target.id)?.c || 0;
    const bsThrown   = db.prepare('SELECT COUNT(*) as c FROM bs_calls WHERE guild_id = ? AND caller_id = ?').get(interaction.guildId, target.id)?.c || 0;
    const flipFlops  = db.prepare('SELECT COUNT(*) as c FROM flip_flops WHERE guild_id = ? AND target_id = ?').get(interaction.guildId, target.id)?.c || 0;

    return interaction.reply({ embeds: [profileEmbed(member, userData, rank, bsReceived, bsThrown, flipFlops)] });
  },
};
