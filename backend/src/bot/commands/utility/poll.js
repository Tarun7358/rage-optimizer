const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const dbService = require('../../../services/dbService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a premium interactive poll with buttons')
    .addStringOption(option => 
      option.setName('question')
        .setDescription('The question to ask')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('option_1')
        .setDescription('Option A')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('option_2')
        .setDescription('Option B')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('option_3')
        .setDescription('Option C')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('option_4')
        .setDescription('Option D')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const opt1 = interaction.options.getString('option_1');
    const opt2 = interaction.options.getString('option_2');
    const opt3 = interaction.options.getString('option_3');
    const opt4 = interaction.options.getString('option_4');
    const { user, guild } = interaction;

    await interaction.deferReply({ ephemeral: true });

    const rawOptions = [opt1, opt2, opt3, opt4].filter(Boolean);
    const options = rawOptions.map((label, idx) => ({
      index: idx,
      label,
      votesCount: 0
    }));

    // Create unique poll ID using guild and timestamp
    const pollId = `poll_${guild.id}_${Date.now()}`;

    // Store in DB
    const pollData = {
      pollId,
      guildId: guild.id,
      question,
      options,
      votes: {}, // maps userId -> optionIndex
      creatorId: user.id,
      creatorName: user.username,
      createdAt: new Date().toISOString()
    };

    await dbService.savePoll(pollId, pollData);

    // Build buttons row
    const row = new ActionRowBuilder();
    const buttonStyles = [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger];
    const letters = ['A', 'B', 'C', 'D'];

    options.forEach((opt, idx) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote:${pollId}:${opt.index}`)
          .setLabel(`Option ${letters[idx]}: ${opt.label}`)
          .setStyle(buttonStyles[idx] || ButtonStyle.Secondary)
      );
    });

    const embed = new EmbedBuilder()
      .setColor('#ff003c')
      .setTitle(`📊 Poll: ${question}`)
      .setDescription(options.map((opt, idx) => `**Option ${letters[idx]}**: ${opt.label}\n░░░░░░░░░░ 0% (0 votes)`).join('\n\n'))
      .setFooter({ text: `Created by ${user.username} | Total Votes: 0` })
      .setTimestamp();

    await interaction.channel.send({
      embeds: [embed],
      components: [row]
    });

    await interaction.editReply({ content: '📊 Interactive button-based poll created successfully!' });
  }
};
