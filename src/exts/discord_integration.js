const { bridge } = require('../spring_api');
const { log } = require('../spring_log');
const { config } = require('../launcher_config');
const DiscordRPC = require("discord-rpc");

if (config) {
    if (config.discord_rich_presence.application_id == null) {
        log.warn("config.discord_rich_presence.application_id not defined");
        return
    }
}

// Application ID from https://discord.com/developers/applications/<applicationId>/
const applicationId = "1185990483143569448";
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

DiscordRPC.register(applicationId);

bridge.on('DiscordSetActivity', async command => {
    // command
    // {
    //     state - string
    //     details - string
    //     startTimestamp - unix timestamp
    //     playerCount - int > 0
    //     maxPlayerCount - int > 0
    //     partyId - string
    //     largeImageText - string
    //     smallImageKey - string
    //     smallImageText - string
    // }

    if (!rpc) {
        log.warn("DiscordSetActivity - No Discord RPC");
        return
    };

    // Playing, spectating, in menu, in lobby, watching replay...
    const state = command.state;

    // Map name
    const details = command.details;

    // Epoch seconds for game start - including will show time as "elapsed"
    const startTimestamp = command.startTimestamp;

    // Name of the uploaded image for the large profile artwork
    // Minimap Image URL
    const largeImageKey = command.details ?
        String(config.discord_rich_presence.minimap_link).replace("<map>", encodeURIComponent(command.details)) :
        config.discord_rich_presence.large_image_key_default;   

    // Tooltip for the largeImageKey
    const largeImageText = command.largeImageText ?
        command.largeImageText :
        config.discord_rich_presence.large_image_text_default;

    // Name of the uploaded image key for the small profile artwork
    const smallImageKey = command.smallImageKey ? command.smallImageKey : config.discord_rich_presence.small_image_key_default;

    // Tooltip for the smallImageKey
    const smallImageText = command.smallImageText ? command.smallImageText : config.discord_rich_presence.small_image_text_default;

    // Both playerCount and maxPlayerCount have to be > 0 to avoid errors
    let playerCount;
    let maxPlayerCount;

    if(command.playerCount > 0 && command.maxPlayerCount > 0) {
        playerCount = command.playerCount;
        maxPlayerCount = command.maxPlayerCount;
    }

    // Party id (battle id for now)
    const partyId = String(command.partyId)

    rpc.setActivity({
        state: state,
        details: details,
        startTimestamp: startTimestamp,
        largeImageKey: largeImageKey,
        largeImageText: largeImageText,
        smallImageKey: smallImageKey,    
        smallImageText: smallImageText,
        partySize: playerCount,
        partyMax: maxPlayerCount,
        partyId: partyId,
        buttons: [{
            label: "Play",
            url: "https://www.beyondallreason.info/",
        }]
    });
});

rpc.login({ clientId: applicationId }).catch(console.error);
