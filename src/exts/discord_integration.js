const { bridge } = require('../spring_api');
const { log } = require('../spring_log');
const DiscordRPC = require("discord-rpc");

// Application ID from https://discord.com/developers/applications/<clientId>/
const clientId = '1185990483143569448';

DiscordRPC.register(clientId);
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

bridge.on('DiscordSetActivity', async command => {
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
        `https://maps-metadata.beyondallreason.dev/latest/discordPresenceThumb/redir.${encodeURIComponent(command.details)}.1024.jpg` :
        'barlogobox';

    // Tooltip for the largeImageKey
    const largeImageText = command.largeImageText ? command.largeImageText : 'Beyond All Reason';

    // Name of the uploaded image key for the small profile artwork
    const smallImageKey = command.smallImageKey ? command.smallImageKey : 'barlogobox';

    // Tooltip for the smallImageKey
    const smallImageText = command.smallImageKey ? command.smallImageKey : 'Beyond All Reason';

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
        }],
    });
});

rpc.login({ clientId }).catch(console.error);
