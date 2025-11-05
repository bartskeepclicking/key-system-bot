// Roblox Key System + Discord Bot
import express from "express";
import { randomUUID } from "crypto";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";

const app = express();
app.use(express.json());

const keys = {};
const ADMIN_SECRET = "mysecret";

app.post("/admin/generate", (req, res) => {
  const secret = req.header("x-admin-secret");
  if (secret !== ADMIN_SECRET) return res.status(401).json({ error: "unauthorized" });

  const key = randomUUID().replace(/-/g, "").toUpperCase().slice(0, 16);
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  keys[key] = { expires, used: false };
  res.json({ success: true, key, expires });
});

app.get("/validate", (req, res) => {
  const key = (req.query.key || "").toUpperCase();
  const data = keys[key];
  if (!data) return res.json({ valid: false, reason: "not_found" });
  if (data.used) return res.json({ valid: false, reason: "already_used" });
  if (Date.now() > data.expires) return res.json({ valid: false, reason: "expired" });
  data.used = true;
  res.json({ valid: true });
});

app.get("/", (_, res) => res.send("✅ Key System + Discord Bot Active"));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === "generate") {
    const key = randomUUID().replace(/-/g, "").toUpperCase().slice(0, 16);
    const expires = Date.now() + 24 * 60 * 60 * 1000;
    keys[key] = { expires, used: false };
    await interaction.reply(`✅ Key generated: **${key}** (valid 1 day)`);
  }
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: [{ name: "generate", description: "Generate a new Roblox key" }],
    });
    console.log("✅ /generate command registered");
  } catch (err) {
    console.error(err);
  }
})();

client.login(DISCORD_TOKEN);

const listener = app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Web API running on port", listener.address().port)
);
