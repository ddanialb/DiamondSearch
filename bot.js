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

// Set axios timeout for faster responses
axios.defaults.timeout = 10000;

// Function to get Iran time
function getIranTime() {
  const now = new Date();
  const iranTime = new Date(now.getTime() + 3.5 * 60 * 60 * 1000); // UTC+3:30
  return iranTime;
}

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

const hexCommand = new SlashCommandBuilder()
  .setName("hex")
  .setDescription(
    "Search for player identifiers (Discord ID, Steam Hex, License, etc.)"
  )
  .addStringOption((option) =>
    option
      .setName("identifier")
      .setDescription(
        "Enter Discord ID, Steam Hex, Username, License, License2, Live, XBL, or FiveM ID"
      )
      .setRequired(true)
  );

// Register slash commands
const commands = [searchCommand, hexCommand];

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
  } else if (interaction.commandName === "hex") {
    await handleHexCommand(interaction);
  }
});

async function handleSearchCommand(interaction) {
  // Log the search request
  console.log(`🔍 Search Request:`);
  console.log(`   User ID: ${interaction.user.id}`);
  console.log(`   Username: ${interaction.user.username}`);
  console.log(
    `   Display Name: ${
      interaction.user.displayName || interaction.user.username
    }`
  );
  console.log(`   Searched Player ID: ${interaction.options.getInteger("id")}`);
  console.log(`   Guild: ${interaction.guild?.name || "DM"}`);
  console.log(`   Time: ${getIranTime().toLocaleString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  try {
    // Get the player ID from the command
    const playerId = interaction.options.getInteger("id");

    // Reply immediately to prevent timeout
    await interaction.reply({
      content: "🔍 Searching for player...",
    });

    // Fetch data from API with timeout and retry
    let response;
    try {
      response = await axios.get(API_URL, { timeout: 10000 });
    } catch (firstError) {
      // Retry once if first attempt fails
      console.log(`🔄 Retrying API call for Player ID '${playerId}'...`);
      response = await axios.get(API_URL, { timeout: 15000 });
    }
    const players = response.data;

    if (!players || players.length === 0) {
      const noPlayersEmbed = new EmbedBuilder()
        .setTitle("Player Search Result")
        .setDescription("```diff\n- Server Empty\n```")
        .setColor(0xffaa00)
        .addFields({
          name: "Server Information",
          value: `- **Server:** \`Diamond RolePlay\`\n- **Status:** \`Empty\`\n- **Players:** \`0\`\n- **Last Check:** <t:${Math.floor(
            Date.now() / 1000
          )}:R>\n- **Error:** \`No players online\``,
          inline: false,
        })
        .setFooter({
          text: "Developed by AghaDaNi",
          iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
        });

      await interaction.editReply({ embeds: [noPlayersEmbed] });

      // Log server empty
      console.log(`⚠️ Search Result: Server is empty (0 players online)`);
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
          value: `- **Player ID:** \`${playerId}\`\n- **Name:** \`Not Found\`\n- **Status:** \`Offline\`\n- **Playing On:** \`Diamond RolePlay\`\n- **Error:** \`Player not in server or Server error\``,
          inline: false,
        })
        .setFooter({
          text: "Developed by AghaDaNi",
          iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
        });

      await interaction.editReply({ embeds: [notFoundEmbed] });

      // Log player not found
      console.log(
        `❌ Search Result: Player ID '${playerId}' not found in server`
      );
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
        value: `- **Player ID:** \`${playerId}\`\n- **Name:** \`${name}\`\n- **Ping:** \`${ping} ms\`\n- **Playing On:** \`Diamond RolePlay\`\n- **Joined At:** <t:${Math.floor(
          joinedAt.getTime() / 1000
        )}:R>`,
        inline: false,
      })
      .setFooter({
        text: "Developed by AghaDaNi",
        iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
      });

    await interaction.editReply({ embeds: [embed] });

    // Log successful search result
    console.log(
      `✅ Search Result: Player '${name}' (ID: ${playerId}) found with ping ${ping}ms`
    );
  } catch (error) {
    // Log API error silently
    console.log(
      `⚠️ API failed after retry for Player ID '${interaction.options.getInteger(
        "id"
      )}' - User: ${interaction.user.username}`
    );

    const errorEmbed = new EmbedBuilder()
      .setTitle("Player Search Result")
      .setDescription("```diff\n- Error\n```")
      .setColor(0xffaa00)
      .addFields({
        name: "Error Information",
        value: `- **Server:** \`Diamond RolePlay\`\n- **Status:** \`Connection Timeout\`\n- **Error:** \`Server response too slow\`\n- **Time:** <t:${Math.floor(
          Date.now() / 1000
        )}:R>\n- **Type:** \`Timeout Error\``,
        inline: false,
      })
      .setFooter({
        text: "Developed by AghaDaNi",
        iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
      });

    // Try to respond with error embed
    try {
      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (editError) {
      // If edit fails, try to send a new message
      try {
        await interaction.followUp({ embeds: [errorEmbed] });
      } catch (followUpError) {
        // If both fail, just continue silently
      }
    }
  }
}

async function handleHexCommand(interaction) {
  // Log the hex search request
  console.log(`🔍 Hex Search Request:`);
  console.log(`   User ID: ${interaction.user.id}`);
  console.log(`   Username: ${interaction.user.username}`);
  console.log(
    `   Display Name: ${
      interaction.user.displayName || interaction.user.username
    }`
  );
  console.log(
    `   Searched Identifier: ${interaction.options.getString("identifier")}`
  );
  console.log(`   Guild: ${interaction.guild?.name || "DM"}`);
  console.log(`   Time: ${getIranTime().toLocaleString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  try {
    const identifier = interaction.options.getString("identifier");

    // Reply immediately to prevent timeout
    await interaction.reply({
      content: "🔍 جستجوی شناسه...",
    });

    // Fetch data from player-finder API
    let response;
    try {
      response = await axios.get(
        `https://game-tools.ir/api/player-finder?query=${encodeURIComponent(
          identifier
        )}&page=1&perPage=10`,
        { timeout: 10000 }
      );
    } catch (firstError) {
      console.log(`🔄 Retrying API call for identifier '${identifier}'...`);
      response = await axios.get(
        `https://game-tools.ir/api/player-finder?query=${encodeURIComponent(
          identifier
        )}&page=1&perPage=10`,
        { timeout: 15000 }
      );
    }

    const data = response.data;

    if (!data.accounts || data.accounts.length === 0) {
      const notFoundEmbed = new EmbedBuilder()
        .setTitle("نتیجه جستجوی شناسه")
        .setDescription("```diff\n- یافت نشد\n```")
        .setColor(0xff0000)
        .addFields({
          name: "اطلاعات",
          value: `- **شناسه جستجو شده:** \`${identifier}\`\n- **وضعیت:** \`یافت نشد\`\n- **تعداد نتایج:** \`0\`\n- **خطا:** \`هیچ اکانتی با این شناسه پیدا نشد\``,
          inline: false,
        })
        .setFooter({
          text: "Developed by AghaDaNi",
          iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
        });

      await interaction.editReply({ embeds: [notFoundEmbed] });
      console.log(
        `❌ Hex Search Result: No accounts found for '${identifier}'`
      );
      return;
    }

    // Get the first account (most relevant)
    const account = data.accounts[0];

    // Build player information fields
    let playerInfo = "";

    // Name
    if (account.name) {
      playerInfo += `- **نام کاربری:** \`${account.name}\`\n`;
    }

    // Discord info
    if (account.discord) {
      if (account.discord.name) {
        playerInfo += `- **نام کاربری دیسکورد:** \`${account.discord.name}\`\n`;
      }
      if (account.discord.displayName) {
        playerInfo += `- **نام نمایشی دیسکورد:** \`${account.discord.displayName}\`\n`;
      }
      if (account.discord.id) {
        playerInfo += `- **آی دی دیسکورد:** \`${account.discord.id}\`\n`;
      }
    }

    // Steam info
    if (account.steam) {
      if (account.steam.hex) {
        playerInfo += `- **Steam Hex:** \`${account.steam.hex}\`\n`;
      }
      if (account.steam.name) {
        playerInfo += `- **نام کاربری Steam:** \`${account.steam.name}\`\n`;
      }
      if (account.steam.id) {
        playerInfo += `- **Steam ID:** \`${account.steam.id}\`\n`;
      }
      if (account.steam.url) {
        playerInfo += `- **Steam URL:** [پروفایل](${account.steam.url})\n`;
      }
    }

    // License
    if (account.license) {
      playerInfo += `- **License:** \`${account.license}\`\n`;
    }

    // License2
    if (account.license2) {
      playerInfo += `- **License2:** \`${account.license2}\`\n`;
    }

    // Live
    if (account.live) {
      playerInfo += `- **Live:** \`${account.live}\`\n`;
    }

    // XBL
    if (account.xbl) {
      playerInfo += `- **XBL:** \`${account.xbl}\`\n`;
    }

    // FiveM
    if (account.fivem) {
      playerInfo += `- **FiveM:** \`${account.fivem}\`\n`;
    }

    // Add server play time info if available
    if (account.playTimes && account.playTimes.length > 0) {
      const playTime = account.playTimes[0];
      const hours = Math.floor(playTime.playTime / 60);
      const minutes = playTime.playTime % 60;
      playerInfo += `\n**اطلاعات سرور:**\n`;
      playerInfo += `- **سرور:** \`${playTime.server.name}\`\n`;
      playerInfo += `- **زمان بازی:** \`${hours}h ${minutes}m\`\n`;
    }

    // Add total results count
    playerInfo += `\n- **تعداد کل نتایج:** \`${data.count}\`\n`;

    if (!playerInfo) {
      playerInfo = "- **خطا:** `اطلاعاتی یافت نشد`";
    }

    const embed = new EmbedBuilder()
      .setTitle("نتیجه جستجوی شناسه")
      .setDescription("```diff\n+ یافت شد\n```")
      .setColor(0x00ff00)
      .addFields({
        name: "اطلاعات بازیکن",
        value: playerInfo,
        inline: false,
      })
      .setFooter({
        text: "Developed by AghaDaNi",
        iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
      });

    // Add avatar if available
    if (account.discord && account.discord.avatar) {
      embed.setThumbnail(account.discord.avatar);
    } else if (account.steam && account.steam.avatar) {
      embed.setThumbnail(account.steam.avatar);
    }

    await interaction.editReply({ embeds: [embed] });

    console.log(
      `✅ Hex Search Result: Found account '${account.name}' for identifier '${identifier}'`
    );
  } catch (error) {
    console.log(
      `⚠️ API failed for identifier '${interaction.options.getString(
        "identifier"
      )}' - User: ${interaction.user.username}`
    );
    console.error("Error details:", error.message);

    const errorEmbed = new EmbedBuilder()
      .setTitle("نتیجه جستجوی شناسه")
      .setDescription("```diff\n- خطا\n```")
      .setColor(0xffaa00)
      .addFields({
        name: "اطلاعات خطا",
        value: `- **وضعیت:** \`خطا در اتصال\`\n- **خطا:** \`سرور پاسخ نداد\`\n- **زمان:** <t:${Math.floor(
          Date.now() / 1000
        )}:R>\n- **نوع:** \`Timeout Error\``,
        inline: false,
      })
      .setFooter({
        text: "Developed by AghaDaNi",
        iconURL: "https://cdn.discordapp.com/emojis/1234567890123456789.png",
      });

    try {
      await interaction.editReply({ embeds: [errorEmbed] });
    } catch (editError) {
      try {
        await interaction.followUp({ embeds: [errorEmbed] });
      } catch (followUpError) {
        // Silent fail
      }
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
