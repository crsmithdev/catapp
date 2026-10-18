# Critters

A web app for cats on an iPad. Small creatures cross the screen, seen from above. A paw touch on a creature makes it squeak and burst into one of five effects: pop, confetti, stars, shockwave or sparkle. A near miss makes it run away. A touch on empty ground makes a ripple. There is no menu, no text and no score.

Five scenes show in turn, each with its own creatures:

| Scene | Creatures |
|---|---|
| Kitchen floor | mice |
| Meadow | butterflies, ladybugs |
| Desert | lizards, beetles |
| Pond | fish |
| Living room at night | laser dots |

## Settings

Hold the gear at the top right for one second to open the settings. A short tap does nothing, so a cat cannot open it. The settings are:
- scene change interval (default 2 minutes)
- creatures on screen (default 3)
- creature speed
- speed variation: how much speeds differ between creatures and between dashes
- creature size (new creatures only)
- touch effect size
- run away from near touches: how far away a touch scares a creature and how fast it runs (off to 2×)
- master volume, for all sound
- scene sounds: the volume of each scene's background (room tone, breeze, wind, water, crickets) and its events (birds, bees, frogs, an owl and more)
- creature sounds: the volume of the creatures' own noises (squeaks, patter, clicks, bubbles and more)
- sound frequency: how often scene and creature sounds play
- volume variation: how much each sound's volume changes from one play to the next

The iPad keeps the settings in the browser. To add a setting, add a field to `FIELDS` in `settings.js` and read `settings.<key>` where it applies.

No build step and no dependencies. All art is drawn in code and all sound is synthesized. Each scene has its own background sounds, and each creature kind makes its own noises, at random gaps.

## Serve

```
./serve.sh
```

This serves the app on port 8421 to the home network.

WSL2 in NAT mode does not take connections from the network. Do this once, in an admin PowerShell on Windows:

```
netsh interface portproxy add v4tov4 listenaddress=<windows-lan-ip> listenport=8421 connectaddress=127.0.0.1 connectport=8421
New-NetFirewallRule -DisplayName "catapp 8421" -Direction Inbound -Protocol TCP -LocalPort 8421 -Action Allow -Profile Private
```

The proxy goes to `127.0.0.1`, and Windows forwards `127.0.0.1` to WSL, so the proxy continues to work when the WSL IP changes. The proxy must listen on the LAN IP only. A proxy on `0.0.0.0` also takes `127.0.0.1:8421` and sends each connection back to itself. To find the Windows LAN IP, run `ipconfig` and look for the IPv4 address of the Wi-Fi or Ethernet adapter. If the LAN IP changes, delete the proxy and add it again.

## Set up the iPad

1. In Safari, open `http://<windows-lan-ip>:8421`.
2. Tap Share, then Add to Home Screen. Open Critters from the Home Screen. It opens full screen.
3. Turn on Guided Access: Settings > Accessibility > Guided Access. Set a passcode. Set Display Auto-Lock to Never.
4. In Critters, triple-click the top button (or the Home button) and tap Start. The cat cannot leave the app, and notifications and Control Center do not show.
5. To stop, triple-click and enter the passcode.

The first touch turns on the sound. iOS does not allow sound before a touch.

## Limits

The app is served over plain HTTP on the LAN, so:
- The PC must be on. There is no offline mode.
- The page cannot keep the screen on. Guided Access's Display Auto-Lock does that.

An HTTPS host, for example GitHub Pages, removes both limits.
