#!/bin/sh
# netmon: reset all traffic counters + persistent saved usage.
# Flushes the volatile nft counter sets and zeroes qstate.json so per-device
# totals start from scratch. nm_block is left intact (blocks are config-driven
# and will be recomputed by the next enforce run).
nft flush set inet fw4 nm_up    2>/dev/null
nft flush set inet fw4 nm_down  2>/dev/null
nft flush set inet fw4 nm_qup   2>/dev/null
nft flush set inet fw4 nm_qdown 2>/dev/null
echo "{}" > /root/netmon/data/qstate.json
exit 0
