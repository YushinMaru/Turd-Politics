const { SlashCommandBuilder } = require('discord.js');
const { getLeaderboard } = require('../../services/reputationService');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, leaderboardEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top 10 political debaters on this server'),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const rows = getLeaderboard(interaction.guildId, 10);
    return interaction.reply({ embeds: [leaderboardEmbed(rows)] });
  },
};
