// ===============================
// ✅ FULL KEY SYSTEM + DISCORD BOT
// ===============================

import express from "express";
import { randomUUID } from "crypto";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import fs from "fs";

// ===============================
// ✅ EXPRESS SETUP
// ===============================
const app = express();
app.use(express.json());

// ===============================
// ✅ LOAD / SAVE KEYS
// ===============================
const keysFile = "./keys.json";
let keys = fs.existsSync(keysFile) ? JSON.parse(fs.readFileSync(keysFile)) : {};

function saveKeys() {
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
}

// ===============================
// ✅ API ENDPOINTS
// ===============================
app.get("/", (_, res) => res.send("✅ Key System API Online!"));

// validate endpoint with HWID
app.get("/validate", (req, res) => {
  const { key, userid, hwid } = req.query;

  if (!key || !userid || !hwid)
    return res.json({ valid: false, reason: "missing_params" });

  const data = keys[key];
  if (!data) return res.json({ valid: false, reason: "not_found" });
  if (data.used) return res.json({ valid: false, reason: "already_used" });
  if (data.expires && Date.now() > data.expires)
    return res.json({ valid: false, reason: "expired" });
  if (data.owner !== userid)
    return res.json({ valid: false, reason: "wrong_owner" });

  // ✅ HWID SYSTEM
  if (!data.hwid) {
    // First login, bind HWID
    data.hwid = hwid;
    saveKeys();
  } else if (data.hwid !== hwid) {
    return res.json({ valid: false, reason: "hwid_mismatch" });
  }

  return res.json({ valid: true, hwid: data.hwid });
});

// ===============================
// ✅ DISCORD BOT SETUP
// ===============================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ===============================
// ✅ COMMAND: /generate
// ===============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "generate") {
    const duration = interaction.options.getString("duration");
    const targetId = interaction.options.getString("userid");

    let expires = null;
    if (duration === "1d") expires = Date.now() + 1 * 24 * 60 * 60 * 1000;
    else if (duration === "7d") expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
    else if (duration === "lifetime") expires = null;

    const key = randomUUID().replace(/-/g, "").toUpperCase().slice(0, 16);

    keys[key] = {
      expires,
      used: false,
      owner: targetId,
      hwid: null
    };

    saveKeys();

    const expiryText = expires ? new Date(expires).toLocaleString() : "Never (Lifetime)";

    return interaction.reply({
      content:
        `✅ **Key Generated!**\n\`\`\`${key}\`\`\`\n🕒 Expires: **${expiryText}**\n🔗 Bound to ID: **${targetId}**`,
      ephemeral: true
    });
  }
});

// ===============================
// ✅ COMMAND: /delete
// ===============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== "delete") return;

  const keyToDelete = interaction.options.getString("key");

  if (!keys[keyToDelete])
    return interaction.reply({ content: "❌ Key not found.", ephemeral: true });

  delete keys[keyToDelete];
  saveKeys();

  interaction.reply({
    content: `✅ Key **${keyToDelete}** has been deleted.`,
    ephemeral: true
  });
});

// ===============================
// ✅ COMMAND: /listkeys
// ===============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== "listkeys") return;

  let out = "🧾 **All Keys:**\n\n";

  for (const [key, data] of Object.entries(keys)) {
    out += `**${key}**\nOwner: ${data.owner}\nUsed: ${data.used}\nExpires: ${
      data.expires ? new Date(data.expires).toLocaleString() : "Lifetime"
    }\nHWID: ${data.hwid ?? "None"}\n\n`;
  }

  interaction.reply({ content: out || "No keys exist.", ephemeral: true });
});

// ===============================
// ✅ COMMAND: /userinfo
// ===============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== "userinfo") return;

  const id = interaction.options.getString("userid");

  const userKeys = Object.entries(keys).filter(([k, d]) => d.owner === id);

  if (userKeys.length === 0)
    return interaction.reply({
      content: "❌ This user has no keys.",
      ephemeral: true
    });

  let out = `🔍 **Keys for ${id}:**\n\n`;

  for (const [key, data] of userKeys) {
    out += `**${key}**\nUsed: ${data.used}\nExpires: ${
      data.expires ? new Date(data.expires).toLocaleString() : "Lifetime"
    }\nHWID: ${data.hwid ?? "None"}\n\n`;
  }

  interaction.reply({ content: out, ephemeral: true });
});

// ===============================
// ✅ REGISTER SLASH COMMANDS
// ===============================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [
      {
        name: "generate",
        description: "Generate a Roblox key",
        options: [
          {
            name: "duration",
            type: 3,
            required: true,
            description: "Duration",
            choices: [
              { name: "1 Day", value: "1d" },
              { name: "7 Days", value: "7d" },
              { name: "Lifetime", value: "lifetime" }
            ]
          },
          {
            name: "userid",
            type: 3,
            required: true,
            description: "Discord ID to bind to"
          }
        ]
      },

      {
        name: "delete",
        description: "Delete a key",
        options: [
          {
            name: "key",
            type: 3,
            required: true,
            description: "Key to delete"
          }
        ]
      },

      {
        name: "listkeys",
        description: "List all keys"
      },

      {
        name: "userinfo",
        description: "View keys for a user",
        options: [
          {
            name: "userid",
            type: 3,
            required: true,
            description: "User ID to lookup"
          }
        ]
      }
    ]
  });

  console.log("✅ Slash commands registered");
})();

// ===============================
// ✅ START SERVER + BOT
// ===============================
client.login(DISCORD_TOKEN);

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 API running on", listener.address().port);
});
