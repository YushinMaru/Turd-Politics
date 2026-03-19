const { SlashCommandBuilder } = require('discord.js');
const { getDebate } = require('../../services/debateService');
const { getTally } = require('../../services/voteService');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, votePollEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vote-results')
    .setDescription('Show the current vote tally for a debate')
    .addIntegerOption(o => o.setName('id').setDescription('Debate ID').setRequired(true)),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const debateId = interaction.options.getInteger('id');
    const debate = getDebate(debateId, interaction.guildId);
    if (!debate) return interaction.reply({ embeds: [errorEmbed(`Debate #${debateId} not found.`)], ephemeral: true });

    if (debate.status === 'open') {
      return interaction.reply({ embeds: [errorEmbed(`Debate #${debateId} is still open for arguments. Voting hasn't started yet.`)], ephemeral: true });
    }

    const tally = getTally(debateId);
    return interaction.reply({ embeds: [votePollEmbed(debate, tally)] });
  },
};
