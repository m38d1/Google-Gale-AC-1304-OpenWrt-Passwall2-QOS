#!/bin/sh
# Validates the v18 overlay without a router and without building anything.
# Run from the repository root:  sh tests/validate-overlay.sh
set -u

fail=0
pass=0
ok()   { pass=$((pass+1)); printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }

printf '\n== shell syntax ==\n'
found=0
for f in $(find files24 -type f \( -name '*.sh' -o -path '*/uci-defaults/*' \)); do
	found=$((found+1))
	if sh -n "$f" 2>/dev/null; then ok "$f"; else bad "$f (syntax)"; sh -n "$f" || true; fi
done
[ "$found" -gt 0 ] || bad "no shell files found under files24/"

printf '\n== shebangs ==\n'
for f in $(find files24 -type f \( -name '*.sh' -o -path '*/uci-defaults/*' \)); do
	head -1 "$f" | grep -q '^#! */bin/sh' && ok "$f" || bad "$f (no sh shebang)"
done

printf '\n== executable bits in git ==\n'
for f in $(find files24/etc/uci-defaults -type f) $(find files24/root -name '*.sh'); do
	[ -x "$f" ] && ok "$f is executable" || bad "$f is not executable"
done

printf '\n== one-shot guards ==\n'
# Every uci-defaults script must be safe to re-run: first-boot scripts run
# again on sysupgrade --reset, and a script without a guard will happily
# overwrite a tuned config.
for f in files24/etc/uci-defaults/*; do
	if grep -q 'v18-.*\.applied\|passwall2-tuned.applied' "$f"; then
		ok "$(basename "$f") has an applied-guard"
	else
		bad "$(basename "$f") has no applied-guard"
	fi
done

# grep only real code: these files are full of comments explaining the bug
# behind each check, and a comment that mentions a forbidden call would
# otherwise fail the very rule it documents.
code() { sed -e 's/[[:space:]]*#.*$//' -e '/^$/d' "$1"; }

printf '\n== no secrets committed ==\n'
# A subscription URL or a UUID in the overlay would leak every deployment.
if grep -rIlE 'option url .(https?://|[a-z0-9]{6,}:)|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' files24 2>/dev/null | grep -q .; then
	bad "possible credential in files24/:"
	grep -rInE 'option url .(https?://|[a-z0-9]{6,}:)|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' files24 2>/dev/null | sed 's/^/       /'
else
	ok "no subscription URLs or UUIDs under files24/"
fi

printf '\n== the shunt is wired to the balancer ==\n'
PW=files24/etc/uci-defaults/zz-passwall2-tuned
grep -q "option default_node 'balancenode'" "$PW" && ok "shunt default_node -> balancenode" \
	|| bad "shunt does not point at balancenode"
grep -q "option fallback_node '_direct'" "$PW" && ok "balancer falls back to direct" \
	|| bad "balancer has no _direct fallback"
grep -q "option Iran '_direct'" "$PW" && ok "Iran rule -> direct" || bad "Iran rule missing"
# All shunt rules must sit in the default group, because a shunt node only
# activates rules whose group matches its own shunt_group.
if grep -q "option shunt_group ''" "$PW"; then
	n=$(grep -c "^config shunt_rules" "$PW")
	g=$(grep -c "^\toption group " "$PW" || true)
	[ "$g" -eq 0 ] && ok "all $n shunt rules in the default group" \
		|| bad "$g of $n shunt rules pin a group, so the rest will never apply"
else
	bad "shunt_group is not empty; grouped rules would be ignored"
fi

printf '\n== the nftset trap ==\n'
# If dnsmasq-full is not installed, the shunt's DNS instance crash-loops and
# no tunnel can come up. The fix must be present in zz-deps.
grep -q 'dnsmasq-full' files24/etc/uci-defaults/zz-deps && ok "zz-deps installs dnsmasq-full" \
	|| bad "zz-deps does not install dnsmasq-full"
grep -q 'kmod-nft-tproxy' files24/etc/uci-defaults/zz-deps && ok "zz-deps installs the tproxy modules" \
	|| bad "zz-deps does not install the tproxy modules"

printf '\n== geo dataset that actually has an ir list ==\n'
grep -q 'Chocolate4U/Iran-v2ray-rules' "$PW" && ok "geo URLs point at the Iran dataset" \
	|| bad "geo URLs are not the Iran dataset; geosite:ir will not parse"

printf '\n== LED logic ==\n'
L=files24/root/netled.sh
grep -q 'through_tunnel' "$L" && ok "LED tests the tunnel" || bad "LED never tests the tunnel"
grep -q 'socks5-hostname' "$L" && ok "LED probes through the node SOCKS port" \
	|| bad "LED does not probe the tunnel"
# The v16 bug: passwall_enabled alone cannot distinguish proxied from direct.
code "$L" | grep -q 'passwall_enabled' && bad "LED still uses the v16 passwall_enabled shortcut" \
	|| ok "LED does not use the v16 passwall_enabled shortcut"
grep -q 'LED0_Blue' "$L" && grep -q 'LED0_Green' "$L" && grep -q 'LED0_Red' "$L" \
	&& ok "LED names all three colours" || bad "LED colour names incomplete"

printf '\n== uplink ==\n'
U=files24/etc/uci-defaults/zz-uplink
grep -q 'UPLINK1_METRIC:-10' "$U" && ok "primary metric defaults to 10" || bad "primary metric not set"
grep -q 'UPLINK2_METRIC:-20' "$U" && ok "standby metric defaults to 20" || bad "standby metric not set"
grep -q 'iw dev' "$U" && ok "uplink pins the radio to the uplink channel" \
	|| bad "uplink does not handle the shared-channel constraint"
# A watchdog that moves routes re-introduces the oscillation fixed in v18.
code files24/root/uplink-watchdog.sh | grep -q 'ifdown' \
	&& bad "watchdog still manipulates interfaces" \
	|| ok "watchdog only monitors, failover is the kernel's job"

printf '\n== build workflow ==\n'
W=.github/workflows/build-firmware.yml
[ -f "$W" ] && ok "workflow present" || bad "no workflow"
if [ -f "$W" ]; then
	grep -q "PROFILE: 'google_wifi'" "$W" && ok "profile pinned to google_wifi" || bad "profile not pinned"
	grep -q 'XRAY_MIN' "$W" && ok "workflow enforces a minimum xray version" || bad "no xray version floor"
	grep -q 'sha256sum -c' "$W" && ok "workflow verifies downloads" || bad "downloads are unverified"
	grep -q 'FILES=' "$W" && ok "overlay is passed via FILES=" || bad "overlay not wired in"
	grep -q 'sh -n' "$W" && ok "workflow lints the overlay" || bad "no overlay lint"
fi

printf '\n== result ==\n'
printf '  %d passed, %d failed\n\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
