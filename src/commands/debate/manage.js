const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDebate, openVoting, archiveDebate, deleteDebate, flagDebate } = require('../../services/debateService');
const { saveVoteMessage } = require('../../services/voteService');
const { scheduleVoteClose } = require('../../services/schedulerService');
const { isMod, requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, successEmbed, votePollEmbed, flagEmbed } = require('../../utils/embeds');
const { STATUS } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debate-mod')
    .setDescription('Moderator debate management commands')
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('(Mod) Open voting on a debate')
        .addIntegerOption(o => o.setName('id').setDescription('Debate ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('archive')
        .setDescription('(Mod) Archive a closed debate')
        .addIntegerOption(o => o.setName('id').setDescription('Debate ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('(Mod) Permanently delete a debate')
        .addIntegerOption(o => o.setName('id').setDescription('Debate ID').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('flag')
        .setDescription('Flag a debate topic for moderator review')
        .addIntegerOption(o => o.setName('id').setDescription('Debate ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const debateId = interaction.options.getInteger('id');
    const config = requireServerConfig(interaction.guildId);

    if (!config) {
      return interaction.reply({ embeds: [errorEmbed('Server not configured. Run `/setup` first.')], ephemeral: true });
    }

    const debate = getDebate(debateId, interaction.guildId);
    if (!debate) {
      return interaction.reply({ embeds: [errorEmbed(`Debate #${debateId} not found.`)], ephemeral: true });
    }

    // Mod-only actions
    if (['close', 'archive', 'delete'].includes(sub) && !isMod(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('You need Manage Server permission to use this command.')], ephemeral: true });
    }

    if (sub === 'close') {
      if (debate.status !== STATUS.OPEN) {
        return interaction.reply({ embeds: [errorEmbed(`Debate #${debateId} is not open (current status: ${debate.status}).`)], ephemeral: true });
      }

      await interaction.deferReply();
      const updated = openVoting(debateId, interaction.guildId, interaction.user.id);

      // Calculate when voting closes
      const voteClosesAt = Math.floor(Date.now() / 1000) + (config.vote_duration_hours * 3600);

      // Build vote poll embed with buttons
      const tally = { side_a: 0, side_b: 0, draw: 0 };
      const pollEmbed = votePollEmbed(updated, tally);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`vote_sidea_${debateId}`).setLabel(updated.side_a_label).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`vote_sideb_${debateId}`).setLabel(updated.side_b_label).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`vote_draw_${debateId}`).setLabel('Draw').setStyle(ButtonStyle.Secondary),
      );

      // Post in results channel
      const resultsChannel = await interaction.guild.channels.fetch(config.results_channel_id);
      const pollMessage = await resultsChannel.send({
        content: `Voting is now open for Debate #${debateId}! Closes <t:${voteClosesAt}:R>`,
        embeds: [pollEmbed],
        components: [row],
      });

      saveVoteMessage(debateId, resultsChannel.id, pollMessage.id, voteClosesAt);

      // Schedule auto-close
      scheduleVoteClose(interaction.client, debateId, voteClosesAt);

      // Notify thread that voting has opened
      if (updated.thread_id) {
        try {
          const thread = await interaction.guild.channels.fetch(updated.thread_id);
          await thread.send(`🗳️ **Voting is now open!** Head to <#${resultsChannel.id}> to cast your vote. Voting closes <t:${voteClosesAt}:R>.`);
        } catch {}
      }

      return interaction.editReply({ embeds: [successEmbed('Voting Opened!', `Voting for Debate #${debateId} is now live in <#${resultsChannel.id}>.`)] });
    }

    if (sub === 'archive') {
      archiveDebate(debateId, interaction.guildId, interaction.user.id);
      return interaction.reply({ embeds: [successEmbed('Archived', `Debate #${debateId} has been archived.`)] });
    }

    if (sub === 'delete') {
      const deleted = deleteDebate(debateId, interaction.guildId, interaction.user.id);
      // Optionally delete the thread too
      if (deleted?.thread_id) {
        try {
          const thread = await interaction.guild.channels.fetch(deleted.thread_id);
          await thread.delete('Debate deleted by moderator');
        } catch {}
      }
      return interaction.reply({ embeds: [successEmbed('Deleted', `Debate #${debateId} ("${deleted.topic}") has been deleted.`)] });
    }

    if (sub === 'flag') {
      flagDebate(debateId, interaction.guildId, interaction.user.id);

      // Post to mod queue channel
      if (config.modqueue_channel_id) {
        try {
          const modQueue = await interaction.guild.channels.fetch(config.modqueue_channel_id);
          const flagRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`flag_dismiss_${debateId}`).setLabel('Dismiss').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`flag_delete_${debateId}`).setLabel('Delete Debate').setStyle(ButtonStyle.Danger),
          );
          await modQueue.send({ embeds: [flagEmbed(debate, interaction.user)], components: [flagRow] });
        } catch {}
      }

      return interaction.reply({ embeds: [successEmbed('Flagged', `Debate #${debateId} has been flagged for moderator review.`)], ephemeral: true });
    }
  },
};
