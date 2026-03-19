const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../db/db');
const { errorEmbed, configEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Show or update bot configuration')
    .addSubcommand(sub =>
      sub.setName('show').setDescription('Show the current server configuration'))
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Update a single config value')
        .addStringOption(o =>
          o.setName('key')
            .setDescription('Config key to update')
            .setRequired(true)
            .addChoices(
              { name: 'vote_duration_hours', value: 'vote_duration_hours' },
              { name: 'max_topic_length', value: 'max_topic_length' },
            ))
        .addStringOption(o => o.setName('value').setDescription('New value').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = db.prepare('SELECT * FROM servers WHERE guild_id = ?').get(interaction.guildId);

    if (!config) {
      return interaction.reply({ embeds: [errorEmbed('This server has not been configured yet. Run `/setup` first.')], ephemeral: true });
    }

    if (sub === 'show') {
      return interaction.reply({ embeds: [configEmbed(config)] });
    }

    if (sub === 'set') {
      const key = interaction.options.getString('key');
      const value = interaction.options.getString('value');
      const numVal = parseInt(value, 10);

      if (isNaN(numVal) || numVal < 1) {
        return interaction.reply({ embeds: [errorEmbed('Value must be a positive number.')], ephemeral: true });
      }

      const allowedKeys = ['vote_duration_hours', 'max_topic_length'];
      if (!allowedKeys.includes(key)) {
        return interaction.reply({ embeds: [errorEmbed('Invalid config key.')], ephemeral: true });
      }

      db.prepare(`UPDATE servers SET ${key} = ? WHERE guild_id = ?`).run(numVal, interaction.guildId);
      const updated = db.prepare('SELECT * FROM servers WHERE guild_id = ?').get(interaction.guildId);
      return interaction.reply({ embeds: [configEmbed(updated)] });
    }
  },
};
