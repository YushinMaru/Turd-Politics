const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../db/db');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, flipFlopEmbed } = require('../../utils/embeds');
const { auditLog } = require('../../services/debateService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flip-flop')
    .setDescription('Accuse someone of changing their position!')
    .addUserOption(o => o.setName('user').setDescription('The alleged flip-flopper').setRequired(true))
    .addIntegerOption(o => o.setName('debate_id').setDescription('Which debate? (optional)')),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const target = interaction.options.getUser('user');
    const debateId = interaction.options.getInteger('debate_id') ?? null;

    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Accusing yourself of flip-flopping? Bold move.')], ephemeral: true });
    }

    db.prepare('INSERT INTO flip_flops (guild_id, accuser_id, target_id, debate_id) VALUES (?, ?, ?, ?)')
      .run(interaction.guildId, interaction.user.id, target.id, debateId);
    auditLog(interaction.guildId, 'flip_flop_called', interaction.user.id, target.id, debateId ? `Debate #${debateId}` : null);

    return interaction.reply({ embeds: [flipFlopEmbed(interaction.user, target, debateId)] });
  },
};
