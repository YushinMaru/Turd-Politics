const { SlashCommandBuilder } = require('discord.js');
const { getLeaderboard } = require('../../services/reputationService');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, podiumEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('podium')
    .setDescription('Show the Turd Politics podium — the top 3 debaters!'),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const top3 = getLeaderboard(interaction.guildId, 3);
    return interaction.reply({ embeds: [podiumEmbed(top3)] });
  },
};
