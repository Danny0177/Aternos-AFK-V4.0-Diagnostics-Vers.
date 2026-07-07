const mineflayer = require("mineflayer");
const settings = require("./settings.json");

function createBot() {

    const bot = mineflayer.createBot({
        host: settings.server.host,
        port: settings.server.port,
        username: settings.account.username,
        version: settings.server.version
    });

    bot.once("spawn", () => {
        console.log("Bot connected!");
    });

    bot.on("end", () => {
        console.log("Disconnected. Reconnecting...");
        setTimeout(createBot, settings.reconnectDelay);
    });

    bot.on("error", err => {
        console.log("Bot error:", err.message);
    });
}

createBot();
