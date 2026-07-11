const http = require("http");
const mineflayer = require("mineflayer");
const settings = require("./settings.json");

// --------------------------------------------------
// Render Web Service keep-alive server
// --------------------------------------------------

http.createServer((req, res) => {
    res.writeHead(200);
    res.end("AFK bot is running");
}).listen(process.env.PORT || 3000);


// --------------------------------------------------
// Logging
// --------------------------------------------------

function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}


// --------------------------------------------------
// Error protection
// --------------------------------------------------

process.on("uncaughtException", err => {
    console.error(`[${new Date().toLocaleTimeString()}] Uncaught Exception:`, err);
});

process.on("unhandledRejection", err => {
    console.error(`[${new Date().toLocaleTimeString()}] Unhandled Rejection:`, err);
});


// --------------------------------------------------
// Bot variables
// --------------------------------------------------

let reconnectDelay = settings.reconnect.initialDelay;
let bot = null;
let spawnTimeout = null;


// --------------------------------------------------
// Create bot
// --------------------------------------------------

function createBot() {

    log("Creating bot...");

    bot = mineflayer.createBot({
        host: settings.server.host,
        port: settings.server.port,
        username: settings.account.username,
        version: settings.server.version
    });


    // ----------------------------------------------
    // Connection stages
    // ----------------------------------------------

    bot.on("connect", () => {
        log("TCP connected");
    });


    bot.on("inject_allowed", () => {
        log("Protocol injected");
    });


    bot.on("login", () => {
    log("Login packet received");
});


// ----------------------------------------------
// Resource pack
// ----------------------------------------------

bot.on("resourcePack", (url, hash) => {

    log("RESOURCE PACK EVENT FIRED");
    log("URL: " + url);
    log("Hash: " + hash);

    if (settings.resourcePack.accept) {

        log("Accepting resource pack...");

        bot.acceptResourcePack();

    } else {

        log("Declining resource pack...");

        bot.denyResourcePack();

    }

});


    // ----------------------------------------------
    // Successful join
    // ----------------------------------------------

    bot.once("spawn", () => {

    log("Bot joined successfully!");

    if (spawnTimeout) {
        clearTimeout(spawnTimeout);
    }

    reconnectDelay = settings.reconnect.initialDelay;


        // Optional lightweight activity
        if (settings.activity.enabled) {

            setInterval(() => {

                if (!bot.entity) return;


                bot.look(
                    bot.entity.yaw + 0.05,
                    bot.entity.pitch,
                    true
                );


                log("Activity tick");

            }, settings.activity.interval);

        }


        // Optional login command
        if (settings.loginCommand !== "") {

            setTimeout(() => {

                log("Sending login command");

                bot.chat(settings.loginCommand);

            }, 3000);

        }

    });


    // ----------------------------------------------
    // Server events
    // ----------------------------------------------

    bot.on("kicked", reason => {

        log(
            "Kicked: " +
            JSON.stringify(reason)
        );

    });


    bot.on("message", message => {

        const text = message.toString();

        // Only log important messages
        if (text.length > 0) {
            log("Server message: " + text);
        }

    });


    // ----------------------------------------------
// Errors
// ----------------------------------------------

bot.on("error", err => {

    log(
        "Bot error: " +
        err.message
    );

});


// ----------------------------------------------
// Spawn timeout
// ----------------------------------------------

spawnTimeout = setTimeout(() => {

    log("Bot failed to spawn within 60 seconds.");
    log("Closing connection and retrying.");

    try {
        bot.quit();
    } catch {}

}, 60000);


    // ----------------------------------------------
    // Disconnect handling
    // ----------------------------------------------

    bot.on("end", reason => {

        log(
            "Disconnected: " +
            reason
        );

        scheduleReconnect();

    });


    bot.on("close", () => {

        log("Connection closed");

    });

}


// --------------------------------------------------
// Reconnect system
// --------------------------------------------------

function scheduleReconnect() {

    log(
        `Reconnecting in ${reconnectDelay / 1000} seconds...`
    );


    setTimeout(() => {

        createBot();

    }, reconnectDelay);


    reconnectDelay = Math.min(
        reconnectDelay * 2,
        settings.reconnect.maxDelay
    );

}


// --------------------------------------------------
// Start bot
// --------------------------------------------------

createBot();
