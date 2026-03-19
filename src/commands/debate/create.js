const { SlashCommandBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../db/db');
const { createDebate, setDebateThread } = require('../../services/debateService');
const { isDebateBanned, requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, debateAnnouncementEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debate')
    .setDescription('Manage debate topics')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new political debate topic')
        .addStringOption(o => o.setName('topic').setDescription('The debate topic or question').setRequired(true).setMaxLength(200))
        .addStringOption(o => o.setName('side_a').setDescription('Label for the "For" side (default: For)').setMaxLength(30))
        .addStringOption(o => o.setName('side_b').setDescription('Label for the "Against" side (default: Against)').setMaxLength(30))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'create') return;

    const config = requireServerConfig(interaction.guildId);
    if (!config) {
      return interaction.reply({ embeds: [errorEmbed('This server has not been set up yet. An admin needs to run `/setup` first.')], ephemeral: true });
    }

    if (isDebateBanned(interaction.guildId, interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('You are banned from participating in debates on this server.')], ephemeral: true });
    }

    const topic = interaction.options.getString('topic');
    const sideA = interaction.options.getString('side_a') || 'For';
    const sideB = interaction.options.getString('side_b') || 'Against';

    if (topic.length > config.max_topic_length) {
      return interaction.reply({ embeds: [errorEmbed(`Topic is too long. Max ${config.max_topic_length} characters.`)], ephemeral: true });
    }

    await interaction.deferReply();

    // Create debate in DB
    const debate = createDebate(interaction.guildId, topic, interaction.user.id, sideA, sideB);

    // Build the announcement embed and subscribe button
    const embed = debateAnnouncementEmbed(debate, interaction.user);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`subscribe_${debate.id}`)
        .setLabel('Subscribe to Notifications')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔔'),
    );

    // Post announcement in debates channel
    let announceMessage = null;
    try {
      const debatesChannel = await interaction.guild.channels.fetch(config.debates_channel_id);

      // If it's a Forum channel, create a new post (thread) inside it
      if (debatesChannel.type === ChannelType.GuildForum) {
        const thread = await debatesChannel.threads.create({
          name: topic.slice(0, 100),
          message: { embeds: [embed], components: [row] },
        });
        setDebateThread(debate.id, thread.id, thread.id);
        announceMessage = await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        // Regular text channel: post announcement, then create a thread from it
        announceMessage = await debatesChannel.send({ embeds: [embed], components: [row] });
        const thread = await announceMessage.startThread({
          name: `[Debate #${debate.id}] ${topic}`.slice(0, 100),
          autoArchiveDuration: 10080, // 7 days
        });
        setDebateThread(debate.id, thread.id, announceMessage.id);
        await interaction.editReply({ content: `Debate created! Head to <#${debatesChannel.id}> to see the discussion.` });
      }
    } catch (err) {
      console.error('[debate create]', err);
      return interaction.editReply({ embeds: [errorEmbed('Failed to create the debate thread. Make sure I have the right permissions.')] });
    }
  },
};
