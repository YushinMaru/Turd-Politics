const { getDebateByThreadId, addParticipant } = require('../services/debateService');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Ignore bots and messages outside threads
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;

    const debate = getDebateByThreadId(message.channel.id);
    if (!debate) return;

    const isNew = addParticipant(debate.id, message.author.id);
    if (isNew) {
      console.log(`[Participation] ${message.author.tag} joined debate #${debate.id}`);
    }
  },
};
