const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../db/db');
const { getDebate } = require('../../services/debateService');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe to or unsubscribe from debate notifications')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Get DM notifications when a debate moves to voting or closes')
        .addIntegerOption(o => o.setName('debate_id').setDescription('Debate ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Unsubscribe from a debate\'s notifications')
        .addIntegerOption(o => o.setName('debate_id').setDescription('Debate ID').setRequired(true))),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const debateId = interaction.options.getInteger('debate_id');
    const debate = getDebate(debateId, interaction.guildId);
    if (!debate) return interaction.reply({ embeds: [errorEmbed(`Debate #${debateId} not found.`)], ephemeral: true });

    if (sub === 'add') {
      try {
        db.prepare('INSERT INTO subscriptions (debate_id, user_id) VALUES (?, ?)').run(debateId, interaction.user.id);
        return interaction.reply({ embeds: [successEmbed('Subscribed!', `You'll get a DM when debate #${debateId} moves to voting or concludes.`)], ephemeral: true });
      } catch {
        return interaction.reply({ embeds: [errorEmbed('You are already subscribed to this debate.')], ephemeral: true });
      }
    }

    if (sub === 'remove') {
      const result = db.prepare('DELETE FROM subscriptions WHERE debate_id = ? AND user_id = ?').run(debateId, interaction.user.id);
      if (result.changes === 0) {
        return interaction.reply({ embeds: [errorEmbed('You are not subscribed to this debate.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [successEmbed('Unsubscribed', `You will no longer receive notifications for debate #${debateId}.`)], ephemeral: true });
    }
  },
};
