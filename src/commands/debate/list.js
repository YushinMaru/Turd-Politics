const { SlashCommandBuilder } = require('discord.js');
const { listDebates } = require('../../services/debateService');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, debateListEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debates')
    .setDescription('List all active and voting debates in this server'),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) {
      return interaction.reply({ embeds: [errorEmbed('This server has not been set up yet.')], ephemeral: true });
    }

    const debates = listDebates(interaction.guildId);
    return interaction.reply({ embeds: [debateListEmbed(debates)] });
  },
};
