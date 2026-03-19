const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { RANDOM_TOPICS, COLORS } = require('../../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('random-debate')
    .setDescription('Get a random spicy political debate topic suggestion!'),

  async execute(interaction) {
    const topic = RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
    const embed = new EmbedBuilder()
      .setColor(COLORS.FUN)
      .setTitle('Random Debate Topic')
      .setDescription(`💡 **${topic}**`)
      .setFooter({ text: 'Use /debate create to start debating this!' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
