const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../db/db');
const { isMod } = require('../../utils/permissions');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { auditLog } = require('../../services/debateService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debate-ban')
    .setDescription('Ban or unban a user from debates')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('(Mod) Ban a user from creating, participating, or voting in debates')
        .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the ban')))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('(Mod) Lift a debate ban from a user')
        .addUserOption(o => o.setName('user').setDescription('User to unban').setRequired(true))),

  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('You need Manage Server permission.')], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');

    if (sub === 'add') {
      const reason = interaction.options.getString('reason') || 'No reason given';
      db.prepare('INSERT OR REPLACE INTO bans (guild_id, user_id, banned_by, reason) VALUES (?, ?, ?, ?)')
        .run(interaction.guildId, target.id, interaction.user.id, reason);
      auditLog(interaction.guildId, 'debate_ban_added', interaction.user.id, target.id, reason);
      return interaction.reply({ embeds: [successEmbed('Banned', `<@${target.id}> has been banned from debates.\nReason: ${reason}`)] });
    }

    if (sub === 'remove') {
      const result = db.prepare('DELETE FROM bans WHERE guild_id = ? AND user_id = ?').run(interaction.guildId, target.id);
      if (result.changes === 0) {
        return interaction.reply({ embeds: [errorEmbed(`<@${target.id}> is not debate-banned.`)], ephemeral: true });
      }
      auditLog(interaction.guildId, 'debate_ban_removed', interaction.user.id, target.id, null);
      return interaction.reply({ embeds: [successEmbed('Unbanned', `<@${target.id}>'s debate ban has been lifted.`)] });
    }
  },
};
