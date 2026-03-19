const { castVote, getTally, getVoteMessage } = require('../services/voteService');
const { getDebate, flagDebate, deleteDebate } = require('../services/debateService');
const { db } = require('../db/db');
const { votePollEmbed, errorEmbed, successEmbed } = require('../utils/embeds');
const { isMod } = require('../utils/permissions');
const { STATUS } = require('../utils/constants');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // ── Slash Commands ───────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[Command Error] /${interaction.commandName}:`, err);
        const reply = { embeds: [errorEmbed('An unexpected error occurred.')], ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // ── Button Interactions ──────────────────────────────────────────
    if (interaction.isButton()) {
      const { customId } = interaction;

      // Vote buttons: vote_sidea_<id>, vote_sideb_<id>, vote_draw_<id>
      if (customId.startsWith('vote_')) {
        const parts = customId.split('_');
        const debateId = parseInt(parts[parts.length - 1], 10);
        const voteChoice = parts.slice(1, -1).join('_'); // e.g. 'sidea', 'sideb', 'draw'

        const voteMap = { sidea: 'side_a', sideb: 'side_b', draw: 'draw' };
        const mapped = voteMap[voteChoice];

        if (!mapped) return interaction.reply({ embeds: [errorEmbed('Unknown vote option.')], ephemeral: true });

        const debate = getDebate(debateId);
        if (!debate || debate.status !== STATUS.VOTING) {
          return interaction.reply({ embeds: [errorEmbed('This vote is no longer active.')], ephemeral: true });
        }

        const result = castVote(debateId, interaction.user.id, mapped);
        if (!result.ok) {
          return interaction.reply({ embeds: [errorEmbed(result.reason)], ephemeral: true });
        }

        // Update the poll embed with new tally
        const tally = getTally(debateId);
        const updatedEmbed = votePollEmbed(debate, tally);
        await interaction.update({ embeds: [updatedEmbed] });
        return;
      }

      // Subscribe button on debate announcement
      if (customId.startsWith('subscribe_')) {
        const debateId = parseInt(customId.split('_')[1], 10);
        try {
          db.prepare('INSERT INTO subscriptions (debate_id, user_id) VALUES (?, ?)').run(debateId, interaction.user.id);
          return interaction.reply({ embeds: [successEmbed('Subscribed!', `You'll get a DM when debate #${debateId} goes to vote or concludes.`)], ephemeral: true });
        } catch {
          return interaction.reply({ embeds: [errorEmbed('You are already subscribed to this debate.')], ephemeral: true });
        }
      }

      // Mod flag actions: flag_dismiss_<id>, flag_delete_<id>
      if (customId.startsWith('flag_')) {
        if (!isMod(interaction.member)) {
          return interaction.reply({ embeds: [errorEmbed('Mods only.')], ephemeral: true });
        }

        const parts = customId.split('_');
        const action = parts[1];
        const debateId = parseInt(parts[2], 10);

        if (action === 'dismiss') {
          await interaction.update({ content: `✅ Flag dismissed by <@${interaction.user.id}>`, embeds: [], components: [] });
        } else if (action === 'delete') {
          const debate = getDebate(debateId);
          if (debate?.thread_id) {
            try {
              const thread = await interaction.guild.channels.fetch(debate.thread_id);
              await thread.delete('Debate deleted via flag review');
            } catch {}
          }
          deleteDebate(debateId, interaction.guildId, interaction.user.id);
          await interaction.update({ content: `🗑️ Debate #${debateId} deleted by <@${interaction.user.id}>`, embeds: [], components: [] });
        }
        return;
      }
    }
  },
};
