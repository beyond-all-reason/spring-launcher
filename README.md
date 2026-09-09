# spring-launcher
Launcher for SpringRTS games

[![CI](https://github.com/beyond-all-reason/spring-launcher/actions/workflows/ci.yml/badge.svg)](https://github.com/beyond-all-reason/spring-launcher/actions/workflows/ci.yml)

## What's this for?

spring-launcher provides a simple yet powerful distribution system for games and tools built with the SpringRTS engine. Developers can specify download and launch configurations, and the system will create executable builds. These executables are generated automatically and updates are then be propagated to users.

The following download resources are supported: maps, games, engines and custom HTTP links. For maps, games and engines pr-downloader is used, while custom resources are downloaded from a specified HTTP link and optionally extracted to a directory.

There is cross-platform support with Linux and Windows builds available. Windows additionally contains a portable build which requires no install but also doesn't support auto-updating.

A common usecase is to use spring-launcher to distribute games that use the Chobby lobby, but it's also possible to use spring-launcher without a lobby (see https://github.com/Spring-SpringBoard/SpringBoard-Core/).

## How can I setup spring-launcher for my game?

1. (Optional) As a first step you may want to ensure your game is available on Rapid (not necessary if you intend to provide your game via a custom HTTP link). Rapid is a system which automatically generates games files in an auto-downloadable format any time a new version of your game is ready and distributes (small) delta updates to users. A new test version will be generated any time you make a commit, while a stable version will be created when your commit contains a predefined commit message in the format VERSION{x.xx} - eg. *VERSION{1.02}*. Check https://springrts.com/wiki/Rapid for details.
2. Install the spring-launcher [GitHub App](https://github.com/apps/springrts-launcher) in a GitHub repository where you want to manage your game updates. This can be done in your game repository, but it can also be created separately.  This template https://github.com/Spring-Chobby/DistCfg/ may be helpful to start.
3. Make sure the registered directory has the `dist_cfg/config.json` file, and create it if it doesn't. (see https://github.com/Spring-Chobby/DistCfg/blob/master/dist_cfg/config.json for example)
4. If you have registered your game on rapid, then add the appropriate rapid tags in `dist_cfg\config.json`. 
5. Once you've modified `dist_cfg\config.json`, create a commit and push, and this will trigger the automatic generation of installers of your game. Download links and build status can be viewed here: https://spring-launcher.firebaseapp.com/repo, which will be in the https://spring-launcher.firebaseapp.com/repo/$USER/$REPO format for your game (e.g. https://github.com/Spring-Chobby/DistCfg/ -> https://spring-launcher.firebaseapp.com/repo/Spring-Chobby/DistCfg)

## How do I generate a new installer?

The process is automatic. Simply make a commit in your repository that modifies something in the dist_cfg folder (even changing a single character in the `config.json` file will do) and push it. After a few minutes, new releases for Windows and Linux will be ready on the https://spring-launcher.firebaseapp.com/repo site (always the same URL for your game), and updates will be automatically sent to users.

## Help and Questions

Please join the spring-launcher Discord channel (on the SpringRTS server - https://discord.gg/ZcBJ2c7) for direct access to the developer (@gajop) and other SpringRTS game developers who might be able to assist you with any issues or questions you might have.

## Development Setup

1. Download this repository
2. Install npm if you haven't
3. Create a `config.json` file in the `src` directory. See `config.json` example: https://github.com/Spring-Chobby/DistCfg/blob/master/dist_cfg/config.json
4. Install dependencies with `npm install`
5. Start the program with `npm start`
