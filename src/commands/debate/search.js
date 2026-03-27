const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../db/db');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed } = require('../../utils/embeds');
const { COLORS } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debate-search')
    .setDescription('Search debates by keyword')
    .addStringOption(o =>
      o.setName('query')
        .setDescription('Keyword to search for in debate topics')
        .setRequired(true)
        .setMaxLength(100),
    )
    .addStringOption(o =>
      o.setName('status')
        .setDescription('Filter by status (default: all)')
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Open', value: 'open' },
          { name: 'Voting', value: 'voting' },
          { name: 'Closed', value: 'closed' },
          { name: 'Archived', value: 'archived' },
        ),
    ),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const query = interaction.options.getString('query');
    const status = interaction.options.getString('status') || 'all';

    let debates;
    if (status === 'all') {
      debates = db.prepare(
        "SELECT * FROM debates WHERE guild_id = ? AND topic LIKE ? ORDER BY created_at DESC LIMIT 15",
      ).all(interaction.guildId, `%${query}%`);
    } else {
      debates = db.prepare(
        "SELECT * FROM debates WHERE guild_id = ? AND status = ? AND topic LIKE ? ORDER BY created_at DESC LIMIT 15",
      ).all(interaction.guildId, status, `%${query}%`);
    }

    if (debates.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed(`No debates found matching **"${query}"**${status !== 'all' ? ` with status \`${status}\`` : ''}.`)],
        ephemeral: true,
      });
    }

    const statusEmoji = { open: '💬', voting: '🗳️', closed: '🔒', archived: '📦' };
    const lines = debates.map(d => {
      const emoji = statusEmoji[d.status] || '❓';
      const link = d.thread_id ? ` [→](https://discord.com/channels/${d.guild_id}/${d.thread_id})` : '';
      const participantCount = db.prepare('SELECT COUNT(*) as c FROM participants WHERE debate_id = ?').get(d.id)?.c || 0;
      return `${emoji} **#${d.id}** ${d.topic}${link}\n  \`${d.status}\` · ${participantCount} participant(s)`;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`Search Results: "${query}"`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `${debates.length} result(s)${status !== 'all' ? ` · filtered by: ${status}` : ''}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
