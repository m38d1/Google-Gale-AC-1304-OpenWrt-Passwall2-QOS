# v16.3: OpenWrt 24.10.8 for Google Wifi (Gale) — PassWall v1 light + netmon/netled
#
# ---------------------------------------------------------------------------
# v18: PassWall v2, dual uplink, tunnel-aware LED.
#
# This is a clean build. v16.3's netmon/QoS system, the passwall-seed
# preloader, and the LuCI menu/footer customisations are NOT carried over.
#
# What changed, and why each was necessary:
#
#  * PassWall v1 -> v2. v1 is not in the repo's own release notes as a
#    mistake; the README already flagged the mismatch between the repo name
#    and the v1 core. v18 makes the name true.
#
#  * Xray 26.9.9. The official 24.10.8 feed ships 25.1.30, but PassWall2
#    26.9.x emits a flat VLESS "settings" object; 25.x still wants the nested
#    "vnext" list and aborts with 'VLESS settings: "vnext" is empty'.
#    26.7.11 is the hard floor. v16.3 already shipped 26.9.9, so this is
#    carried forward, not new.
#
#  * dnsmasq-full. PassWall2's shunt writes direct-domain answers into an
#    nftset via dnsmasq. OpenWrt's stock dnsmasq 2.93 is built "no-nftset",
#    so that instance refuses to start, the DNS port never opens, and every
#    lookup fails -- including node server domains, so no tunnel can come up.
#    PassWall2's own probe is fooled here because it greps the version string
#    for "nftset" and "no-nftset" contains that word.
#
#  * Iran geo dataset. The stock geosite.dat has no "ir" list, so geosite:ir
#    fails to parse and xray refuses to start. geoip:ir does exist. The build
#    now points both URLs at Chocolate4U/Iran-v2ray-rules, which carries ir
#    and cn together (57,554 domains, verified).
#
#  * netled.sh rewritten. v16.3 used `passwall_enabled && url_ok -> BLUE`,
#    which shows BLUE precisely when the proxy has degraded to direct,
#    because PassWall's balancer falls back to _direct when nodes die and
#    PassWall stays enabled. v18 probes an endpoint that is unreachable
#    without a proxy, through the node SOCKS port, so blue genuinely means
#    "traffic is going through the tunnel".
#
#  * Dual uplink added. Primary and standby differ by route metric, so the
#    kernel does the failover; a script that moved routes instead was tried
#    first and oscillated, because its reachability probe followed whichever
#    uplink owned the default route.
#
#  * Uplink channels resolved by scan. Every virtual interface on a radio
#    shares one channel, so a station uplink only associates if the radio sits
#    on the uplink's channel. v16.3 hard-coded 2.4GHz to channel 11, which is
#    why the primary uplink on channel 10 could not associate reliably.
#
# Fixed during the v18 build:
#  * four shunt rules carried an explicit `group`, which would have left them
#    permanently inactive under an empty shunt_group
# ---------------------------------------------------------------------------
