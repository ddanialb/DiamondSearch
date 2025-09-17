# DiamondRP Discord Bot

A Discord bot that searches for players on DiamondRP FiveM server.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create .env file:**
   Create a `.env` file in the root directory with:

   ```
   BOT_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here
   ```

3. **Get Discord Bot Credentials:**

   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to Bot section and create a bot
   - Copy the bot token
   - Copy the application ID (Client ID)
   - Get your server ID (Guild ID)

4. **Run the bot:**
   ```bash
   node bot.js
   ```

## Usage

- `/search id:1234` - Search for a player by ID

## Features

- 🎮 Real-time player data from DiamondRP server
- 🎨 Beautiful embeds with color-coded ping
- 📊 Player statistics and information
- ⚡ Fast response times

## Troubleshooting

If you get `ECONNRESET` error:

1. Try mobile hotspot
2. Use VPN
3. Disable Windows Firewall
4. Check if Discord is blocked by your ISP
