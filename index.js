import express from "express";
import { randomUUID } from "crypto";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import fs from "fs";

const app = express();
app.use(express.json());

const keysFile = "./keys.json";
let keys = fs.existsSync(keysFile) ? JSON.parse(fs.readFileSync(keysFile)) : {};

function saveKeys() {
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
}

app.get("/", (_, res) => res.send("✅ Key System API Online"));

app.get("/validate", (req, res) => {
  const { key, userid } = req.query;
  if (!key) return res.json({ valid: false, reason: "no_key" });
  const data = keys[key];
  if (!data) return res.json({ valid: false, reason: "not_found" });
  if (data.used) return res.json({ valid: false, reason: "already_used" });
  if (data.expires && Date.now() > data.expires)
    return res.json({ valid: false, reason: "expired" });
  if (data.owner && data.owner !== userid)
    return res.json({ valid: false, reason: "wrong_owner" });

  res.json({ valid: true });
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => console.log(`🤖 Logged in as ${client.user.tag}`));

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "generate") {
    const duration = interaction.options.getString("duration");
    const discordId = interaction.user.id;

    let expires = null;
    if (duration === "1d") expires = Date.now() + 1 * 24 * 60 * 60 * 1000;
    else if (duration === "7d") expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
    else if (duration === "lifetime") expires = null;

    const key = randomUUID().replace(/-/g, "").toUpperCase().slice(0, 16);
    keys[key] = { expires, used: false, owner: discordId };
    saveKeys();

    const expiryText = expires
      ? new Date(expires).toLocaleString()
      : "Never (Lifetime)";

    await interaction.reply({
      content: `✅ Key: \`${key}\`\n🕒 Expires: **${expiryText}**\n🔗 Bound to: <@${discordId}>`,
      ephemeral: true
    });
  }
});

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
            description: "How long the key lasts",
            type: 3,
            required: true,
            choices: [
              { name: "1 Day", value: "1d" },
              { name: "7 Days", value: "7d" },
              { name: "Lifetime", value: "lifetime" }
            ]
          }
        ]
      }
    ]
  });
  console.log("✅ Slash command registered");
})();

client.login(DISCORD_TOKEN);

const listener = app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 API running on", listener.address().port)
);
