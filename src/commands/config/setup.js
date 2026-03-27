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
    .addIntegerOption(o => o.setName('auto_debate_interval').setDescription('Post a new bot debate every N days (0 = disabled, default: 0)').setMinValue(0).setMaxValue(30))
    .addIntegerOption(o => o.setName('auto_close_days').setDescription('Auto-move stale user debates to voting after N days (0 = disabled, default: 0)').setMinValue(0).setMaxValue(30))
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

    // Preserve existing automation values if not provided
    const existing = db.prepare('SELECT * FROM servers WHERE guild_id = ?').get(interaction.guildId);
    const autoDebateInterval = interaction.options.getInteger('auto_debate_interval') ?? existing?.auto_debate_interval_days ?? 0;
    const autoCloseDays = interaction.options.getInteger('auto_close_days') ?? existing?.auto_close_days ?? 0;

    db.prepare(`
      INSERT INTO servers (guild_id, debates_channel_id, results_channel_id, modqueue_channel_id, auditlog_channel_id, vote_duration_hours, max_topic_length, auto_debate_interval_days, auto_close_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        debates_channel_id = excluded.debates_channel_id,
        results_channel_id = excluded.results_channel_id,
        modqueue_channel_id = excluded.modqueue_channel_id,
        auditlog_channel_id = excluded.auditlog_channel_id,
        vote_duration_hours = excluded.vote_duration_hours,
        max_topic_length = excluded.max_topic_length,
        auto_debate_interval_days = excluded.auto_debate_interval_days,
        auto_close_days = excluded.auto_close_days
    `).run(interaction.guildId, debates.id, results.id, modqueue.id, auditlog.id, voteDuration, maxTopicLength, autoDebateInterval, autoCloseDays);

    const config = db.prepare('SELECT * FROM servers WHERE guild_id = ?').get(interaction.guildId);
    return interaction.reply({ embeds: [configEmbed(config)], ephemeral: false });
  },
};
