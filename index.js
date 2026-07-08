const http = require("http");

http.createServer((req, res) => {
    res.writeHead(200);
    res.end("AFK bot is running");
}).listen(process.env.PORT || 3000);

const mineflayer = require("mineflayer");
const settings = require("./settings.json");

function createBot() {

    console.log("Creating bot...");

    const bot = mineflayer.createBot({
        host: settings.server.host,
        port: settings.server.port,
        username: settings.account.username,
        version: settings.server.version
    });

    bot.on("connect", () => {
        console.log("TCP connected");
    });

    bot.on("inject_allowed", () => {
        console.log("Protocol injected");
    });

    bot.on("login", () => {
        console.log("Login packet received");
    });

    bot.once("spawn", () => {
        console.log("Bot connected!");
    });

    bot.on("kicked", reason => {
        console.log("Kicked reason:", reason);
    });

    bot.on("error", err => {
        console.log("Bot error:", err);
    });

    bot.on("end", reason => {
        console.log("Disconnected reason:", reason);
        console.log("Reconnecting...");
        setTimeout(createBot, settings.reconnectDelay);
    });
}

createBot();
