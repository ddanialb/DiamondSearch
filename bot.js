// Load environment variables
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");
const axios = require("axios");
const express = require("express");

// Bot configuration from environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Check if required environment variables are set
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is not set in .env file!");
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID is not set in .env file!");
  process.exit(1);
}
if (!GUILD_ID) {
  console.error("❌ GUILD_ID is not set in .env file!");
  process.exit(1);
}
const API_URL = "https://game-tools.ir/api/v1/servers/fivem/DiamondRP/players";

// ==================== Express keep-alive server =====================
const app = express();
const port = process.env.PORT || 10000;

// Create bot instance
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Slash command definition
const searchCommand = new SlashCommandBuilder()
  .setName("search")
  .setDescription("Search for a specific player on DiamondRP server")
  .addIntegerOption((option) =>
    option
      .setName("id")
      .setDescription("Player ID to search for")
      .setRequired(true)
  );

// Register slash commands
const commands = [searchCommand];

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    if (GUILD_ID && GUILD_ID !== "YOUR_GUILD_ID_HERE") {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      });
      console.log("Successfully registered guild commands.");
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commands,
      });
      console.log("Successfully registered global commands.");
    }
  } catch (error) {
    console.error("Error registering commands:", error);
  }
})();

// Bot ready event
client.once("ready", () => {
  console.log(`${client.user.tag} has connected to Discord!`);
  console.log("Bot is ready to use!");
});

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "search") {
    await handleSearchCommand(interaction);
  }
});

async function handleSearchCommand(interaction) {
  try {
    // Get the player ID from the command
    const playerId = interaction.options.getInteger("id");

    // Reply immediately to prevent timeout
    await interaction.reply({
      content: "🔍 Searching for player...",
      ephemeral: true,
    });

    // Fetch data from API with timeout
    const response = await axios.get(API_URL, { timeout: 20000 });
    const players = response.data;

    if (!players || players.length === 0) {
      const noPlayersEmbed = new EmbedBuilder()
        .setTitle("Player Search Result")
        .setDescription("```diff\n- Server Empty\n```")
        .setColor(0xffaa00)
        .addFields({
          name: "Server Information",
          value: `• **Server:** \`Diamond RolePlay\`\n• **Status:** \`Empty\`\n• **Players:** \`0\`\n• **Last Check:** <t:${Math.floor(
            Date.now() / 1000
          )}:R>\n• **Error:** \`No players online\``,
          inline: false,
        })
        .setFooter({
          text: "Developed by AghaDaNi",
          iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
        });

      await interaction.followUp({ embeds: [noPlayersEmbed] });
      return;
    }

    // Find the specific player by ID
    const player = players.find((p) => p.id === playerId);

    if (!player) {
      const notFoundEmbed = new EmbedBuilder()
        .setTitle("Player Search Result")
        .setDescription("```diff\n- Offline\n```")
        .setColor(0xff0000)
        .addFields({
          name: "Player Information",
          value: `• **Player ID:** \`${playerId}\`\n• **Name:** \`Not Found\`\n• **Status:** \`Offline\`\n• **Playing On:** \`Diamond RolePlay\`\n• **Error:** \`Player not in server or Server error\``,
          inline: false,
        })
        .setFooter({
          text: "Developed by AghaDaNi",
          iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
        });

      await interaction.followUp({ embeds: [notFoundEmbed] });
      return;
    }

    // Get player data
    const name = player.name || "Unknown";
    const ping = player.ping || 0;
    const joinedAt = player.joinedAt ? new Date(player.joinedAt) : new Date();

    // Calculate time since joined
    const timeDiff = Date.now() - joinedAt.getTime();
    const daysAgo = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutesAgo = Math.floor(timeDiff / (1000 * 60));

    let timeAgo;
    if (daysAgo > 0) {
      timeAgo = `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`;
    } else if (hoursAgo > 0) {
      timeAgo = `${hoursAgo} hour${hoursAgo > 1 ? "s" : ""} ago`;
    } else if (minutesAgo > 0) {
      timeAgo = `${minutesAgo} minute${minutesAgo > 1 ? "s" : ""} ago`;
    } else {
      timeAgo = "Just now";
    }

    // Add ping indicator and color
    let pingEmoji = "🔴";
    let pingColor = "Poor";
    let embedColor = 0xff0000; // Red for poor ping
    let statusEmoji = "⚠️";

    if (ping < 50) {
      pingEmoji = "🟢";
      pingColor = "Excellent";
      embedColor = 0x00ff00; // Green for excellent ping
      statusEmoji = "✨";
    } else if (ping < 100) {
      pingEmoji = "🟡";
      pingColor = "Good";
      embedColor = 0xffaa00; // Orange for good ping
      statusEmoji = "👍";
    }

    // Calculate ping statistics
    const allPings = players.map((p) => p.ping || 0);
    const avgPing = allPings.reduce((a, b) => a + b, 0) / allPings.length;
    const minPing = Math.min(...allPings);
    const maxPing = Math.max(...allPings);

    // Create beautiful embed like the image
    const embed = new EmbedBuilder()
      .setTitle("Player Search Result")
      .setDescription("```diff\n! Online\n```")
      .setColor(0x00ff00)
      .addFields({
        name: "Player Information",
        value: `• **Player ID:** \`${playerId}\`\n• **Name:** \`${name}\`\n• **Ping:** \`${ping} ms\`\n• **Playing On:** \`Diamond RolePlay\`\n• **Joined At:** <t:${Math.floor(
          joinedAt.getTime() / 1000
        )}:R>`,
        inline: false,
      })
      .setFooter({
        text: "Developed by AghaDaNi",
        iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
      });

    await interaction.followUp({ embeds: [embed] });
  } catch (error) {
    console.error("Error in search command:", error);

    const errorEmbed = new EmbedBuilder()
      .setTitle("Player Search Result")
      .setDescription("```diff\n- Error\n```")
      .setColor(0xffaa00)
      .addFields({
        name: "Error Information",
        value: `• **Server:** \`Diamond RolePlay\`\n• **Status:** \`Connection Error\`\n• **Error:** \`Failed to fetch data\`\n• **Time:** <t:${Math.floor(
          Date.now() / 1000
        )}:R>\n• **Type:** \`API Error\``,
        inline: false,
      })
      .setFooter({
        text: "Developed by AghaDaNi",
        iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
      });

    try {
      await interaction.followUp({ embeds: [errorEmbed] });
    } catch (replyError) {
      console.error("Failed to reply to interaction:", replyError);
    }
  }
}

// Express routes
app.get("/", (req, res) => {
  res.send("✅ DiamondRP Searcher Bot is running");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🌐 Express server listening on 0.0.0.0:${port}`);
});

// Error handling
client.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// Start the bot
client.login(BOT_TOKEN).catch((error) => {
  console.error("Failed to login:", error);
  console.log(
    "Make sure to set your BOT_TOKEN, CLIENT_ID, and GUILD_ID in the .env file!"
  );
});
