const { bridge } = require('../spring_api');
const { log } = require('../spring_log');
const { config } = require('../launcher_config');
const DiscordRPC = require("discord-rpc");

if (config.discord_rich_presence.application_id == null) {
    log.warn("config.discord_rich_presence.application_id not defined");
    return
}

// Application ID from https://discord.com/developers/applications/<applicationId>/
const applicationId = config.discord_rich_presence.application_id;
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
let loginSuccessful = false;

DiscordRPC.register(applicationId);

async function TryToLogin() {
    try {
        await rpc.login({ clientId: applicationId });
        loginSuccessful = true;
    } catch (error) {
        log.warn("Discord RPC login error - Discord not running?");
        loginSuccessful = false;
    }
}


//if (!loginSuccessful) return;

bridge.on('DiscordSetActivity', async command => {
    // command
    // https://discord.com/developers/docs/rich-presence/how-to#updating-presence-update-presence-payload-fields
    // {
    //     state : string - Playing, spectating, in menu, in lobby, watching replay...
    //     details : string - Map name
    //     startTimestamp : unix timestamp - including will show time as "elapsed"
    //     playerCount : int > 0
    //     maxPlayerCount : int > 0
    //     partyId : string - battle ID for now
    //     largeImageText : string - tooltip for the largeImageKey
    //     smallImageKey : string - name of the uploaded image for the large profile artwork, can also be URL
    //     smallImageText : string - tooltip for the smallImageKey
    // }


    if(!loginSuccessful) await TryToLogin(); 

    const largeImageKey = command.details ?
        String(config.discord_rich_presence.minimap_url).replace("<map>", encodeURIComponent(command.details)) :
        config.discord_rich_presence.large_image_key_default;   
    const partyId = String(command.partyId)
    let playerCount;
    let maxPlayerCount;
    // Both playerCount and maxPlayerCount have to be > 0 to avoid errors
    if(command.playerCount > 0 && command.maxPlayerCount > 0) {
        playerCount = command.playerCount;
        maxPlayerCount = command.maxPlayerCount;
    }
    
    rpc.setActivity({
        state: command.state,
        details: command.details,
        startTimestamp: command.startTimestamp,
        largeImageKey: largeImageKey,
        largeImageText: command.largeImageText ?? config.discord_rich_presence.large_image_text_default,
        smallImageKey: command.smallImageKey ?? config.discord_rich_presence.small_image_key_default,    
        smallImageText: command.smallImageText ?? config.discord_rich_presence.small_image_text_default,
        partySize: playerCount,
        partyMax: maxPlayerCount,
        partyId: partyId,
        buttons: [{
            label: config.discord_rich_presence.button_label,
            url: config.discord_rich_presence.button_url
        }]
    });
});
