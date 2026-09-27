# v18 — OpenWrt 24.10.8 for Google Wifi (Gale) · PassWall2 · Iran-direct

Firmware image for **one device only**: Google Wifi / Nest Wifi, model `Gale`
(`ipq40xx/chromium`, profile `google_wifi`).

> v16.x shipped **PassWall v1**. v18 moves to **PassWall v2**. The v1 UCI file
> is left alone so a rollback is still possible.

## What it does

| | |
|---|---|
| Base | official OpenWrt **24.10.8**, kernel 6.6.144 |
| Proxy | **PassWall2 26.9.16** — shunt with Iran-direct, auto-failover balancer |
| Core | **Xray 26.9.9** (see below for why this is not the feed version) |
| LAN | `192.168.10.1`, hostname `Gale`, timezone Tehran |
| AP | `Google Router`, both bands, open |
| Uplink | primary + standby wireless, automatic failover by metric |
| LED | red = offline · green = online but direct · blue = online via PassWall |

Nodes are **not** in this repository. Add your own through LuCI, or paste a
subscription URL — nothing sensitive is committed.

## Build

Push a tag; the workflow builds and attaches the image to a Release:

```bash
git tag v18 && git push origin v18
```

Output: `v18-24.10.8-google_wifi-sysupgrade.bin` plus a `.sha256`.

The workflow refuses to build if the profile is missing, if the downloaded
ImageBuilder does not match the published checksum, if Xray comes out older
than 26.7.11, or if a staged `.ipk` fails to reach the package index. It also
runs `sh -n` over every shell file in the overlay before invoking make.

## Flash

```bash
scp -O out/v18-24.10.8-google_wifi-sysupgrade.bin root@192.168.10.1:/tmp/v18.bin
ssh root@192.168.10.1 "sysupgrade /tmp/v18.bin"
```

Keep the config (no `-n`) if you are coming from v16 so your nodes survive.

## After first boot

1. `ssh root@192.168.10.1` (no password by default)
2. Put your key in `/etc/dropbear/authorized_keys`
3. Set the uplinks in `/etc/v18.conf` — SSIDs, keys, which band. **No rebuild
   needed**: `wifi reload && /etc/init.d/network reload` picks it up.
4. Add nodes in LuCI → Services → PassWall2, then enable it

## Configure the uplinks

Everything site-specific lives in `/etc/v18.conf`, so one image serves any
number of sites. Two constraints are worth reading before you fill it in:

**The bands should differ.** A radio listens to exactly one channel, and its
AP and every station on it share that channel. If both uplinks are on 2.4GHz,
the standby has to sit on the primary's channel to associate at all, and the
two lines contend for airtime. `zz-uplink` scans for each uplink's channel and
pins the radio to it, which is why association works even when the channels
differ.

**The subnets must differ.** If both uplands are in the same subnet, two
different routers both claim to be the gateway, and the standby silently
steals the default route — the primary then stops passing traffic. Measured:
`ping -I <primary-dev> 8.8.8.8` → 100% loss, with no failover logic involved.

## Why the build does what it does

**Xray 26.9.9, not the feed's 25.1.30.** PassWall2 26.9.x emits a flat VLESS
`settings` object; xray 25.x still expects the nested `vnext` list and aborts
with `VLESS settings: "vnext" is empty`. 26.7.11 is the hard floor — older
cores also refuse the config outright. The build copies the newer core in via
`FILES=`, which `prepare_rootfs` applies *after* `package_install`, so it
overwrites the packaged binary.

**dnsmasq-full.** PassWall2's shunt writes direct-domain answers into an nftset
through dnsmasq. OpenWrt's stock dnsmasq 2.93 is built `no-nftset`, so that
instance refuses to start, the DNS port never opens, and *every* lookup fails —
including the node server domains, so no tunnel can ever come up. The symptom
is deeply misleading because PassWall2 probes the dnsmasq version string with
`grep -w nftset`, and `no-nftset` contains the word: it believes support
exists. `zz-deps` installs `dnsmasq-full` rather than patching PassWall2.

**The Iran geo dataset.** The stock `geosite.dat` has no `ir` category, so
`geosite:ir` fails to parse and xray refuses to start
(`list not found in geosite.dat: IR`). `geoip:ir` does exist. The build
points both URLs at `Chocolate4U/Iran-v2ray-rules`, which carries `ir` *and*
`cn` — verified, 57,554 domains. The Russia rules from the stock PassWall2
config were dropped: that dataset has no `ru-blocked` either.

## Known limitations

- **v16.3's netmon/QoS, passwall-seed and LuCI menu customisations are not
  carried over.** v18 is a clean build of the v18 feature set only.
- The LED needs an endpoint that is unreachable without a proxy. On an
  unfiltered network nothing qualifies and it will sit on green. Set
  `LED_PROBE_URL` in `/etc/v18.conf`.
- The LED and uplink monitor run from cron, so the resolution is one minute.
- Exit-IP-based node selection means the LED is blue whenever the tunnel
  works, including the moment after a failover while the balancer re-picks.
