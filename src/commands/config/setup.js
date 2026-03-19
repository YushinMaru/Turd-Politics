const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { db } = require('../../db/db');
const { isMod } = require('../../utils/permissions');
const { successEmbed, errorEmbed, configEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure Turd Politics for this server (Admin only)')
    .addChannelOption(o => o.setName('debates').setDescription('Channel to announce new debate topics').addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum).setRequired(true))
    .addChannelOption(o => o.setName('results').setDescription('Channel to post vote polls and results').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption(o => o.setName('modqueue').setDescription('Private channel for flagged debates (mods only)').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption(o => o.setName('auditlog').setDescription('Channel for all bot audit logs').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addIntegerOption(o => o.setName('vote_duration').setDescription('How many hours voting stays open (default: 48)').setMinValue(1).setMaxValue(336))
    .addIntegerOption(o => o.setName('max_topic_length').setDescription('Max character length for debate topics (default: 200)').setMinValue(20).setMaxValue(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('You need Manage Server permission to run setup.')], ephemeral: true });
    }

    const debates = interaction.options.getChannel('debates');
    const results = interaction.options.getChannel('results');
    const modqueue = interaction.options.getChannel('modqueue');
    const auditlog = interaction.options.getChannel('auditlog');
    const voteDuration = interaction.options.getInteger('vote_duration') ?? 48;
    const maxTopicLength = interaction.options.getInteger('max_topic_length') ?? 200;

    db.prepare(`
      INSERT INTO servers (guild_id, debates_channel_id, results_channel_id, modqueue_channel_id, auditlog_channel_id, vote_duration_hours, max_topic_length)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        debates_channel_id = excluded.debates_channel_id,
        results_channel_id = excluded.results_channel_id,
        modqueue_channel_id = excluded.modqueue_channel_id,
        auditlog_channel_id = excluded.auditlog_channel_id,
        vote_duration_hours = excluded.vote_duration_hours,
        max_topic_length = excluded.max_topic_length
    `).run(interaction.guildId, debates.id, results.id, modqueue.id, auditlog.id, voteDuration, maxTopicLength);

    const config = db.prepare('SELECT * FROM servers WHERE guild_id = ?').get(interaction.guildId);
    return interaction.reply({ embeds: [configEmbed(config)], ephemeral: false });
  },
};
