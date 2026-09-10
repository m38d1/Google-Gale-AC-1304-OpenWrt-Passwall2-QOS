// netmon parse helper: read limits.json (any formatting) and emit a flat,
// shell-friendly stream for apply.sh. ucode's json() parses multi-line JSON
// reliably, unlike grep. Output lines:
//   G <max_dl> <max_ul> <lan_if> <wan_if>
//   D <ip> <dl> <ul> <prio>
import * as fs from "fs";

let p = (ARGV && ARGV[0]) ? ARGV[0] : "/root/netmon/limits.json";
let s = null, d = null;
try { s = fs.readfile(p); } catch (e) { s = null; }
if (s != null && s != "") { try { d = json(s); } catch (e) { d = null; } }

if (d != null) {
	let g = d["__global_settings"];
	if (g == null) g = {};
	printf("G %s %s %s %s\n",
		g.max_dl != null ? g.max_dl : 12500,
		g.max_ul != null ? g.max_ul : 12500,
		g.lan_if != null ? g.lan_if : "br-lan",
		g.wan_if != null ? g.wan_if : "phy0-sta0");

	for (let ip in d) {
		if (ip == "__global_settings") continue;
		let e = d[ip];
		if (type(e) != "object") continue;
		printf("D %s %s %s %s\n", ip,
			e.dl != null ? e.dl : 0,
			e.ul != null ? e.ul : 0,
			e.prio != null ? e.prio : 4);
	}
}
