const http = require("http");
const mineflayer = require("mineflayer");
const settings = require("./settings.json");

console.log("=== AFK BOT VERSION 3.0 - Deep Debug ===");

// --------------------------------------------------
// HTTP server for Railway/Render health checks
// --------------------------------------------------

const PORT = process.env.PORT || 8080;

http.createServer((req, res) => {
    res.writeHead(200);
    res.end("AFK bot is running");
}).listen(PORT, () => {
    log(`[HTTP] Server started on port ${PORT}`);
});

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
// Global reconnect state
// --------------------------------------------------

let reconnectDelay = settings.reconnect.initialDelay;
let reconnectTimer = null;
let currentBot = null;
let activityInterval = null;

// --------------------------------------------------
// Reconnect helper
// --------------------------------------------------

function scheduleReconnect(reason = "unknown") {
    if (reconnectTimer) return;

    log(`[Reconnect] Scheduling reconnect in ${reconnectDelay / 1000}s (${reason})`);

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        createBot();
    }, reconnectDelay);

    reconnectDelay = Math.min(
        reconnectDelay * 2,
        settings.reconnect.maxDelay
    );
}

// --------------------------------------------------
// Create bot
// --------------------------------------------------

function createBot() {

    log("==================================================");
    log("[Bot] Creating bot instance...");
    log(`[Bot] Connecting to ${settings.server.host}:${settings.server.port}`);
    log(`[Bot] Version: ${settings.server.version}`);
    log("==================================================");

    let spawnReached = false;
    let cleanedUp = false;

    const bot = mineflayer.createBot({
        host: settings.server.host,
        port: settings.server.port,
        username: settings.account.username,
        version: settings.server.version,
        hideErrors: false
    });

    currentBot = bot;

    // --------------------------------------------------
    // Cleanup helper
    // --------------------------------------------------

    function cleanup() {
        if (cleanedUp) return;
        cleanedUp = true;

        if (activityInterval) {
            clearInterval(activityInterval);
            activityInterval = null;
        }

        if (spawnTimeout) {
            clearTimeout(spawnTimeout);
        }
    }

    // --------------------------------------------------
    // Connection stage logging
    // --------------------------------------------------

    bot.on("connect", () => {
        log("[Stage] TCP connected");
    });

    bot.on("inject_allowed", () => {
        log("[Stage] Protocol injected");
    });

    bot.on("login", () => {
        log("[Stage] Login packet received");
    });

    bot.on("respawn", () => {
        log("[Stage] Respawn event fired");
    });

    bot.on("game", () => {
        log("[Stage] Game state received");
    });

    // --------------------------------------------------
    // Resource pack handling
    // --------------------------------------------------

    bot.on("resourcePack", (url, hash) => {
        log("[ResourcePack] Request received");
        log(`[ResourcePack] URL: ${url}`);
        log(`[ResourcePack] Hash: ${hash}`);

        try {
            log("[ResourcePack] Accepting pack...");
            bot.acceptResourcePack();
        } catch (err) {
            log(`[ResourcePack] Accept failed: ${err.message}`);
        }
    });

    // --------------------------------------------------
    // Deep protocol logging
    // --------------------------------------------------

    if (bot._client) {

        bot._client.on("success", () => {
            log("[Protocol] Login success packet received");
        });

        bot._client.on("disconnect", packet => {
            log("[Protocol] Server sent disconnect packet:");
            try {
                console.log(packet);
            } catch (e) {
                log("[Protocol] Could not print disconnect packet");
            }
        });

        bot._client.on("packet", (data, meta) => {
            const important = [
                "login",
                "success",
                "join_game",
                "respawn",
                "disconnect",
                "resource_pack_send",
                "resource_pack"
            ];

            if (important.includes(meta.name)) {
                log(`[Packet] ${meta.name}`);
            }
        });

        if (bot._client.socket) {
            bot._client.socket.on("timeout", () => {
                log("[Socket] Timeout");
            });

            bot._client.socket.on("close", hadError => {
                log(`[Socket] Closed (hadError=${hadError})`);
            });

            bot._client.socket.on("error", err => {
                log(`[Socket] Error: ${err.message}`);
            });
        }
    }

    // --------------------------------------------------
    // Successful spawn
    // --------------------------------------------------

    bot.once("spawn", () => {

        spawnReached = true;
        cleanup();

        reconnectDelay = settings.reconnect.initialDelay;

        log("==================================================");
        log("[SUCCESS] Bot joined the world!");
        log("==================================================");

        if (settings.loginCommand && settings.loginCommand !== "") {
            setTimeout(() => {
                try {
                    log("[Bot] Sending login command");
                    bot.chat(settings.loginCommand);
                } catch (e) {
                    log(`[Bot] Login command failed: ${e.message}`);
                }
            }, 3000);
        }

        // Very lightweight anti-idle
        activityInterval = setInterval(() => {
            if (!bot.entity) return;

            try {
                bot.look(
                    bot.entity.yaw + 0.05,
                    bot.entity.pitch,
                    true
                );
                log("[Activity] Small look tick");
            } catch (e) {
                log(`[Activity] Failed: ${e.message}`);
            }
        }, 300000); // 5 minutes
    });

    // --------------------------------------------------
    // Spawn timeout
    // --------------------------------------------------

    const spawnTimeout = setTimeout(() => {

        if (spawnReached) return;

        log("==================================================");
        log("[Timeout] Spawn not reached within 180 seconds");
        log("[Timeout] Bot is connected, but never entered the world");
        log("[Timeout] Destroying connection and retrying");
        log("==================================================");

        cleanup();

        try {
            bot.end();
        } catch {}

        scheduleReconnect("spawn timeout");

    }, 180000);

    // --------------------------------------------------
    // Errors
    // --------------------------------------------------

    bot.on("error", err => {

        log(`[Error] ${err.message}`);

        if (err.code) {
            log(`[Error] Code: ${err.code}`);
        }

        if (!spawnReached) {
            cleanup();
            scheduleReconnect(`error ${err.code || err.message}`);
        }
    });

    // --------------------------------------------------
    // Disconnects
    // --------------------------------------------------

    bot.on("kicked", reason => {
        log("[Kicked] Server kicked the bot:");
        try {
            console.log(reason);
        } catch (e) {
            log(String(reason));
        }
    });

    bot.on("end", reason => {

        cleanup();

        log(`[End] Connection ended: ${reason}`);

        if (!spawnReached) {
            scheduleReconnect(`end ${reason}`);
        }
    });

    bot.on("close", () => {
        log("[Close] Connection closed");
    });

    bot.on("message", message => {
        const text = message.toString();
        if (text && text.length > 0) {
            log(`[Server] ${text}`);
        }
    });
}

// --------------------------------------------------
// Start bot
// --------------------------------------------------

createBot();
