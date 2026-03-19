const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../db/db');
const { isDebateBanned, requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, bsEmbed } = require('../../utils/embeds');
const { ensureUser, auditLog } = require('../../services/debateService');
const { POINTS } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bs')
    .setDescription('Call BS on someone\'s argument! (Costs you 5 points)')
    .addUserOption(o => o.setName('user').setDescription('Who are you calling out?').setRequired(true))
    .addIntegerOption(o => o.setName('debate_id').setDescription('Which debate is this about? (optional)')),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const target = interaction.options.getUser('user');
    const debateId = interaction.options.getInteger('debate_id') ?? null;

    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('You can\'t call BS on yourself... or can you?')], ephemeral: true });
    }

    if (isDebateBanned(interaction.guildId, interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('You are banned from debate interactions.')], ephemeral: true });
    }

    // Deduct points from caller
    ensureUser(interaction.guildId, interaction.user.id);
    const caller = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, interaction.user.id);
    if (caller && caller.points < POINTS.BS_CALL_COST) {
      return interaction.reply({ embeds: [errorEmbed(`You need at least ${POINTS.BS_CALL_COST} points to call BS. You only have ${caller.points}.`)], ephemeral: true });
    }

    db.prepare('UPDATE users SET points = points - ? WHERE guild_id = ? AND user_id = ?')
      .run(POINTS.BS_CALL_COST, interaction.guildId, interaction.user.id);
    db.prepare('INSERT INTO bs_calls (guild_id, caller_id, target_id, debate_id) VALUES (?, ?, ?, ?)')
      .run(interaction.guildId, interaction.user.id, target.id, debateId);

    auditLog(interaction.guildId, 'bs_called', interaction.user.id, target.id, debateId ? `Debate #${debateId}` : null);

    return interaction.reply({ embeds: [bsEmbed(interaction.user, target, debateId)] });
  },
};
