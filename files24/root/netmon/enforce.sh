#!/bin/sh
# netmon enforcement: quota + time-window internet blocking.
# Runs every minute via cron. Snapshots nft byte counters, delegates the
# JSON/state logic to enforce.uc, then applies the resulting nm_block set.
CFG=/root/netmon/limits.json
DATA=/root/netmon/data
TMP=/tmp/netmon
mkdir -p "$DATA" "$TMP"

# cumulative per-IP byte counters (no-timeout sets)
nft -j list set inet fw4 nm_qup   > "$TMP/qup.json"   2>/dev/null
nft -j list set inet fw4 nm_qdown > "$TMP/qdown.json" 2>/dev/null

ucode /root/netmon/enforce.uc \
	"$(date +%s)" "$(date +%H:%M)" "$(date +%Y-%m-%d)" "$(date +%Y-%m)" "$(date +%G-W%V)" \
	"$TMP/qup.json" "$TMP/qdown.json" "$CFG" "$DATA/qstate.json" "$TMP/block.nft"

# atomically replace the block set membership
if [ -s "$TMP/block.nft" ]; then
	nft -f "$TMP/block.nft" 2>/dev/null
fi
exit 0
