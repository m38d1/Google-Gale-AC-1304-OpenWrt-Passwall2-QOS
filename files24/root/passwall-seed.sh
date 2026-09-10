#!/bin/sh
# Seeds PassWall1's manual lists (Service -> PassWall -> Access Control ->
# Direct/Block List) with REAL, pre-expanded Iranian data taken from
# geoip.dat / geosite.dat at build time — so it does NOT depend on geoview
# at runtime. Idempotent: a marked block is appended only if missing, so a
# luci-app-passwall upgrade that resets the rule files self-heals next boot.
#   Data sources (survive package upgrades, not package-owned):
#     /etc/passwall-seed/iran-ip.cidr   (2772 Iranian CIDRs: IPv4+IPv6)
#     /etc/passwall-seed/iran-host.dom  (365 Iranian domains + .ir)
RULES=/usr/share/passwall/rules
SEED=/etc/passwall-seed
[ -d "$RULES" ] || exit 0

# --- Direct SSID (Google Router Direct, 192.168.11.0/24) must bypass PassWall.
# PassWall's global "default" rules proxy EVERY interface (no iifname filter),
# so we inject a return for the direct subnet at the top of its chains. This is
# also re-applied here so an apk upgrade of luci-app-passwall self-heals.
NFS=/usr/share/passwall/nftables.sh
if [ -f "$NFS" ] && ! grep -qs 'direct-bypass' "$NFS" 2>/dev/null; then
	awk '
	  /^\t\tmsg="【默认】，"/ && !done {
	    print "\t\tnft \"insert rule $NFTABLE_NAME PSW_MANGLE ip saddr 192.168.11.0/24 counter return comment \\\"direct-bypass\\\"\""
	    print "\t\tnft \"insert rule $NFTABLE_NAME PSW_MANGLE_V6 iifname \\\"br-direct\\\" counter return comment \\\"direct-bypass\\\"\""
	    print "\t\tnft \"insert rule $NFTABLE_NAME PSW_NAT ip saddr 192.168.11.0/24 counter return comment \\\"direct-bypass\\\"\""
	    print "\t\tnft \"insert rule $NFTABLE_NAME PSW_DNS ip saddr 192.168.11.0/24 counter return comment \\\"direct-bypass\\\"\""
	    print "\t\t#seed-direct-bypass"
	    done=1
	  }
	  { print }
	' "$NFS" > "$NFS.tmp" && mv "$NFS.tmp" "$NFS"
fi

# --- Direct IP: every Iranian IP range (expanded from geoip.dat 'IR') ---
if ! grep -qs '#seed-iran-ip' "$RULES/direct_ip" 2>/dev/null; then
	printf '\n#seed-iran-ip\n' >> "$RULES/direct_ip"
	[ -f "$SEED/iran-ip.cidr" ] && cat "$SEED/iran-ip.cidr" >> "$RULES/direct_ip"
fi

# --- Direct host: Iranian domains (expanded from geosite.dat category-*-ir) ---
if ! grep -qs '#seed-iran-host' "$RULES/direct_host" 2>/dev/null; then
	printf '\n#seed-iran-host\n' >> "$RULES/direct_host"
	[ -f "$SEED/iran-host.dom" ] && cat "$SEED/iran-host.dom" >> "$RULES/direct_host"
fi

# --- Block host: conventional ad / tracker / popunder domains ---
grep -qs '#seed-ads' "$RULES/block_host" 2>/dev/null || cat >> "$RULES/block_host" <<'EOF'

#seed-ads
doubleclick.net
googlesyndication.com
googleadservices.com
google-analytics.com
googletagmanager.com
googletagservices.com
adservice.google.com
adnxs.com
pubmatic.com
openx.net
rubiconproject.com
amazon-adsystem.com
criteo.com
criteo.net
indexww.com
smartadserver.com
taboola.com
outbrain.com
adsafeprotected.com
moatads.com
scorecardresearch.com
quantserve.com
chartbeat.com
hotjar.com
mixpanel.com
segment.io
amplitude.com
popads.net
popcash.net
adsterra.com
adstark.com
propellerads.com
onclickads.net
exosrv.com
juicyads.com
revenuehits.com
yektanet.com
adnegah.net
EOF
exit 0
