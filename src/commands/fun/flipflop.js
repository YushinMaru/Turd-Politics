const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../db/db');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, flipFlopEmbed } = require('../../utils/embeds');
const { auditLog } = require('../../services/debateService');
const { COLORS } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flip-flop')
    .setDescription('Flip-flop commands')
    .addSubcommand(sub =>
      sub.setName('accuse')
        .setDescription('Accuse someone of changing their position!')
        .addUserOption(o => o.setName('user').setDescription('The alleged flip-flopper').setRequired(true))
        .addIntegerOption(o => o.setName('debate_id').setDescription('Which debate? (optional)')))
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('See the biggest flip-floppers in this server'))
    .addSubcommand(sub =>
      sub.setName('history')
        .setDescription('See flip-flop accusations against a user')
        .addUserOption(o => o.setName('user').setDescription('User to look up').setRequired(true))),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'accuse') {
      const target = interaction.options.getUser('user');
      const debateId = interaction.options.getInteger('debate_id') ?? null;

      if (target.id === interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Accusing yourself of flip-flopping? Bold move.')], ephemeral: true });
      }

      db.prepare('INSERT INTO flip_flops (guild_id, accuser_id, target_id, debate_id) VALUES (?, ?, ?, ?)')
        .run(interaction.guildId, interaction.user.id, target.id, debateId);
      auditLog(interaction.guildId, 'flip_flop_called', interaction.user.id, target.id, debateId ? `Debate #${debateId}` : null);

      return interaction.reply({ embeds: [flipFlopEmbed(interaction.user, target, debateId)] });
    }

    if (sub === 'stats') {
      const rows = db.prepare(`
        SELECT target_id, COUNT(*) as count
        FROM flip_flops WHERE guild_id = ?
        GROUP BY target_id ORDER BY count DESC LIMIT 10
      `).all(interaction.guildId);

      if (rows.length === 0) {
        return interaction.reply({ embeds: [errorEmbed('No flip-flop accusations have been made yet.')], ephemeral: true });
      }

      const lines = rows.map((r, i) => `${i + 1}. <@${r.target_id}> — **${r.count}** accusation(s)`);

      const embed = new EmbedBuilder()
        .setColor(COLORS.FUN)
        .setTitle('🔄 Biggest Flip-Floppers')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Consistency is apparently optional here.' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'history') {
      const target = interaction.options.getUser('user');
      const rows = db.prepare(`
        SELECT accuser_id, debate_id, created_at FROM flip_flops
        WHERE guild_id = ? AND target_id = ? ORDER BY created_at DESC LIMIT 10
      `).all(interaction.guildId, target.id);

      if (rows.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed(`<@${target.id}> has no flip-flop accusations. A pillar of consistency!`)],
          ephemeral: true,
        });
      }

      const total = db.prepare('SELECT COUNT(*) as c FROM flip_flops WHERE guild_id = ? AND target_id = ?')
        .get(interaction.guildId, target.id)?.c || 0;

      const lines = rows.map(r => {
        const debateRef = r.debate_id ? ` on debate #${r.debate_id}` : '';
        return `• <@${r.accuser_id}> accused them${debateRef}`;
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.FUN)
        .setTitle(`🔄 Flip-Flop History: ${target.username}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${total} total accusation(s)` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};
