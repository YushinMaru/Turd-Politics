const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../services/reputationService');
const { requireServerConfig } = require('../../utils/permissions');
const { errorEmbed, profileEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a user\'s debate profile')
    .addUserOption(o => o.setName('user').setDescription('User to look up (defaults to yourself)')),

  async execute(interaction) {
    const config = requireServerConfig(interaction.guildId);
    if (!config) return interaction.reply({ embeds: [errorEmbed('Server not configured.')], ephemeral: true });

    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ embeds: [errorEmbed('Could not find that member.')], ephemeral: true });

    const userData = getUser(interaction.guildId, target.id);
    return interaction.reply({ embeds: [profileEmbed(member, userData)] });
  },
};
