"""Build web/public/results.json from StatsBomb Open Data.

Premier League 2015/16, all 380 matches. Everything the web app shows is
computed here, offline. The browser only reads the JSON.

Usage:
    python analysis/build.py [path/to/statsbomb/open-data]
"""

import json
import math
import sys
from datetime import date
from pathlib import Path

import pandas as pd

COMPETITION_ID = 2   # Premier League
SEASON_ID = 27       # 2015/16

PITCH_X, PITCH_Y = 120, 80
COLS, ROWS = 6, 4
ZONE_W, ZONE_H = PITCH_X / COLS, PITCH_Y / ROWS

SHOT_WINDOW_S = 10     # a shot counts if it comes within this many seconds of the regain
LOOKBACK_S = 3         # how far back to look for the tackle/interception that won the ball
PRESSURE_WINDOW_S = 5  # regain counts as "after pressure" if we pressed within this window
MIN_N = 30             # zones below this are flagged as low sample and never used in findings

OPEN_PLAY_PATTERNS = {"Regular Play", "From Counter"}
ON_BALL_TYPES = {
    "Ball Recovery", "Interception", "Duel", "Pass", "Carry", "Ball Receipt*",
    "Clearance", "Block", "Dribble", "Shot", "Miscontrol", "Dispossessed", "Shield",
}
COL_NAMES = ["own box", "own third", "own half", "opposition half", "final third", "opposition box"]
ROW_NAMES = ["left wing", "left-centre", "right-centre", "right wing"]


def zone_of(x, y):
    col = min(int(x // ZONE_W), COLS - 1)
    row = min(int(y // ZONE_H), ROWS - 1)
    return col, row


def zone_label(col, row):
    return f"{'ABCDEF'[col]}{row + 1}"


def zone_name(col, row):
    return f"{ROW_NAMES[row]}, {COL_NAMES[col]}"


def seconds(ts):
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def winning_action(e):
    """Return a regain type if this event is the team winning the ball, else None."""
    t = e["type"]["name"]
    if t == "Duel" and e.get("duel", {}).get("type", {}).get("name") == "Tackle":
        if e["duel"].get("outcome", {}).get("name") in {"Won", "Success", "Success In Play", "Success Out"}:
            return "Tackle"
    if t == "Interception":
        if e.get("interception", {}).get("outcome", {}).get("name") in {"Won", "Success", "Success In Play"}:
            return "Interception"
    if t == "Ball Recovery" and not e.get("ball_recovery", {}).get("recovery_failure"):
        return "Recovery"
    return None


def match_turnovers(events, match_id):
    """One row per open-play regain in a match."""
    for e in events:
        e["_t"] = seconds(e["timestamp"])

    # Goals in event order, so we know the score at the moment of each regain.
    goals = [(e["index"], e["team"]["name"]) for e in events
             if (e["type"]["name"] == "Shot" and e["shot"]["outcome"]["name"] == "Goal")
             or e["type"]["name"] == "Own Goal For"]

    by_poss = {}
    for e in events:
        by_poss.setdefault(e["possession"], []).append(e)
    poss_ids = sorted(by_poss)

    rows = []
    for prev_id, pid in zip(poss_ids, poss_ids[1:]):
        evs, prev = by_poss[pid], by_poss[prev_id]
        team = evs[0]["possession_team"]["name"]
        lost_by = prev[0]["possession_team"]["name"]
        if team == lost_by or evs[0]["play_pattern"]["name"] not in OPEN_PLAY_PATTERNS:
            continue
        first = next((e for e in evs if e["team"]["name"] == team
                      and e["type"]["name"] in ON_BALL_TYPES and "location" in e), None)
        if first is None:
            continue
        period = first["period"]

        # The tackle/interception that won the ball is often logged in the opponent's
        # possession, just before ours starts. Prefer it for location and type.
        candidates = [e for e in prev[-15:] + evs[:3]
                      if e["team"]["name"] == team and e["period"] == period
                      and "location" in e and winning_action(e)
                      and first["_t"] - LOOKBACK_S <= e["_t"] <= first["_t"] + 0.5]
        regain = candidates[-1] if candidates else first
        kind = winning_action(regain) or "Loose ball"
        t0 = regain["_t"]

        pressed = any(e["type"]["name"] == "Pressure" and e["team"]["name"] == team
                      and e["period"] == period and t0 - PRESSURE_WINDOW_S <= e["_t"] <= t0
                      for e in prev)

        shots = [e for e in evs if e["type"]["name"] == "Shot" and e["team"]["name"] == team
                 and e["period"] == period and 0 <= e["_t"] - t0 <= SHOT_WINDOW_S
                 and e["shot"]["type"]["name"] != "Penalty"]
        # Probability at least one of the shots scores, so rebounds are not double counted.
        xg = 1 - math.prod(1 - s["shot"]["statsbomb_xg"] for s in shots) if shots else 0.0

        ours = sum(1 for i, t in goals if i < regain["index"] and t == team)
        theirs = sum(1 for i, t in goals if i < regain["index"] and t != team)
        state = "Leading" if ours > theirs else "Trailing" if ours < theirs else "Level"

        x, y = regain["location"][:2]
        sx, sy = shots[0]["location"][:2] if shots else (None, None)
        rows.append({
            "match_id": match_id, "period": period, "minute": regain["minute"],
            "second": regain["second"], "team": team, "opponent": lost_by,
            "player": regain.get("player", {}).get("name"), "kind": kind, "pressed": pressed,
            "x": x, "y": y, "shot": bool(shots), "xg": xg,
            "goal": any(s["shot"]["outcome"]["name"] == "Goal" for s in shots),
            "shooter": shots[0]["player"]["name"] if shots else None,
            "player_id": regain.get("player", {}).get("id"),
            "shooter_id": shots[0]["player"]["id"] if shots else None,
            "sx": sx, "sy": sy, "state": state,
        })
    return rows


def load(root):
    matches = json.loads((root / f"data/matches/{COMPETITION_ID}/{SEASON_ID}.json").read_text())
    rows, names = [], {}
    for m in matches:
        events = json.loads((root / f"data/events/{m['match_id']}.json").read_text())
        match_rows = match_turnovers(events, m["match_id"])
        for r in match_rows:
            r["date"] = m["match_date"]
            r["home"] = r["team"] == m["home_team"]["home_team_name"]
        rows += match_rows
        lineups = root / f"data/lineups/{m['match_id']}.json"
        if lineups.exists():
            for side in json.loads(lineups.read_text()):
                for pl in side["lineup"]:
                    names[pl["player_id"]] = pl.get("player_nickname") or pl["player_name"]
    df = pd.DataFrame(rows)
    # Use the name people know (e.g. "Cesc Fàbregas", not the full legal name).
    df["player"] = [names.get(i, n) for i, n in zip(df["player_id"], df["player"])]
    df["shooter"] = [names.get(i, n) if n else None for i, n in zip(df["shooter_id"], df["shooter"])]
    df[["col", "row"]] = df.apply(lambda r: zone_of(r.x, r.y), axis=1, result_type="expand")
    # The same regain seen from the team that lost the ball: flip into their frame.
    df["col_lost"] = COLS - 1 - df["col"]
    df["row_lost"] = ROWS - 1 - df["row"]
    return matches, df


def zone_stats(g):
    n = len(g)
    xg = g["xg"].to_numpy()
    sd = float(xg.std(ddof=1)) if n > 1 else 0.0
    return {
        "n": n,
        "shots": int(g["shot"].sum()),
        "goals": int(g["goal"].sum()),
        "xg": round(float(xg.sum()), 3),
        "xg_per": round(float(xg.mean()), 4) if n else 0.0,
        "se": round(sd / math.sqrt(n), 4) if n > 1 else None,
        "shot_rate": round(float(g["shot"].mean()), 4) if n else 0.0,
        "pressed_rate": round(float(g["pressed"].mean()), 4) if n else 0.0,
    }


def zone_table(df, col_key, row_key, league):
    out = []
    for col in range(COLS):
        for row in range(ROWS):
            g = df[(df[col_key] == col) & (df[row_key] == row)]
            s = zone_stats(g)
            lg = league[col * ROWS + row]
            s.update(col=col, row=row, label=zone_label(col, row), name=zone_name(col, row),
                     low_n=s["n"] < MIN_N, league_xg_per=lg["xg_per"])
            # Is the gap to league average bigger than ~2 standard errors? If not, say so.
            if s["n"] >= MIN_N and s["se"]:
                diff = s["xg_per"] - lg["xg_per"]
                s["vs_league"] = round(diff, 4)
                s["clear_gap"] = abs(diff) > 1.96 * s["se"]
            else:
                s["vs_league"], s["clear_gap"] = None, False
            out.append(s)
    return out


THIRDS = [("Defensive third", 0), ("Middle third", 2), ("Attacking third", 4)]


def totals(df, n_matches, col_key, league_df):
    s = zone_stats(df)
    s["per_match"] = round(s["n"] / n_matches, 1)
    # Thirds pool two columns each, so high regains get a sample big enough to talk about.
    s["thirds"] = []
    for name, c0 in THIRDS:
        g = df[df[col_key].isin([c0, c0 + 1])]
        t = zone_stats(g)
        lg = zone_stats(league_df[league_df[col_key].isin([c0, c0 + 1])])
        t.update(name=name, league_xg_per=lg["xg_per"], league_share=round(lg["n"] / len(league_df), 4),
                 share=round(t["n"] / max(len(df), 1), 4), low_n=t["n"] < MIN_N)
        t["clear_gap"] = bool(t["se"]) and abs(t["xg_per"] - lg["xg_per"]) > 1.96 * t["se"]
        s["thirds"].append(t)
    return s


def fmt_pct(v):
    return f"{v * 100:.0f}%"


def plural(n, word):
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def vs_league(z, unit="zone"):
    """How a zone compares with the league, in words, with an honest note on noise."""
    if not z["league_xg_per"]:
        return "no league baseline"
    ratio = z["xg_per"] / z["league_xg_per"]
    if ratio >= 1.2:
        words = f"{ratio:.1f}x the league average for that {unit}"
    elif ratio <= 0.8:
        words = f"{ratio:.1f}x the league average for that {unit}, so below par"
    else:
        words = "about the league average for that {unit}"
    if z["clear_gap"]:
        return words + ", a gap larger than chance would explain"
    return words + (", though within normal variation" if abs(ratio - 1) >= 0.2 else "")


def shot_phrase(z):
    if z["shots"] == 0:
        return f"none of {z['n']} regains led to a shot"
    return f"{fmt_pct(z['shot_rate'])} of {z['n']} regains led to a shot within {SHOT_WINDOW_S}s"


def summarise(team, won, conceded, thirds, n_matches):
    """Plain-English notes for a coach. Only zones with n >= MIN_N are eligible."""
    lines = []

    # Headline: the attacking third pooled, since single high zones rarely reach MIN_N.
    att = thirds[2]
    if not att["low_n"]:
        lines.append({"kind": "lead", "title": "High regains",
                      "text": f"You won the ball in the attacking third {att['n']} times "
                              f"({att['n'] / n_matches:.1f} a match). {fmt_pct(att['shot_rate'])} became a shot "
                              f"within {SHOT_WINDOW_S}s, worth {att['xg_per']:.3f} xG per regain: {vs_league(att, "third")}."})
    else:
        lines.append({"kind": "lead", "title": "High regains",
                      "text": f"Only {att['n']} regains in the attacking third all season, too few to judge."})

    # Pressing zones only: past our own third. Regains in our own box are defending, not pressing.
    press = [z for z in won if not z["low_n"] and z["col"] >= 2]

    best = sorted(press, key=lambda z: z["xg_per"], reverse=True)[:2]
    if best:
        parts = [f"<b>{z['label']}</b> ({z['name']}): {shot_phrase(z)}, worth {z['xg_per']:.3f} xG each "
                 f"({vs_league(z)})" for z in best]
        lines.append({"kind": "good", "title": "Most productive regain zones",
                      "text": "Winning it here is most likely to end in a chance. " + "; ".join(parts) + "."})

    # Wasteful: regains that return less than the league gets from the same zone.
    under = [z for z in press if z["league_xg_per"] > 0 and z["xg_per"] < z["league_xg_per"]]
    worst = sorted(under, key=lambda z: z["xg_per"] / z["league_xg_per"])[:2]
    if worst:
        parts = [f"<b>{z['label']}</b> ({z['name']}): {shot_phrase(z)}, "
                 f"{z['xg_per'] / z['league_xg_per']:.1f}x the league return"
                 + ("" if z["clear_gap"] else ", a gap small enough to be noise") for z in worst]
        lines.append({"kind": "bad", "title": "Least productive regain zones",
                      "text": "You win the ball here but get less from it than the average side does. Worth "
                              "reviewing what happens next: first pass, support runners. " + "; ".join(parts) + "."})
    else:
        lines.append({"kind": "bad", "title": "Least productive regain zones",
                      "text": "Every well-sampled zone beyond your own third returns at least the league "
                              "average, so there is no clear dead zone in the press."})

    risky = [z for z in conceded if not z["low_n"] and z["shots"] > 0]
    if risky:
        z = max(risky, key=lambda z: z["xg"])
        lines.append({"kind": "warn", "title": "Biggest vulnerability",
                      "text": f"Losing the ball in <b>{z['label']}</b> ({z['name']}) cost the most: "
                              f"{z['n']} turnovers, {fmt_pct(z['shot_rate'])} led to an opposition shot within "
                              f"{SHOT_WINDOW_S}s, {z['xg']:.1f} xG conceded across the season "
                              f"({plural(z['goals'], 'goal')}). Rest-defence cover behind this area is the "
                              f"first thing to check."})

    lines.append({"kind": "note", "title": "Read with care",
                  "text": f"These are associations over {n_matches} matches, not proof that pressing in a "
                          f"zone causes shots. Zones with fewer than {MIN_N} turnovers are hatched on the map "
                          f"and left out of these notes."})
    return lines


STATES = ["Leading", "Level", "Trailing"]
FLIP_STATE = {"Leading": "Trailing", "Level": "Level", "Trailing": "Leading"}


def chains(w, c):
    """Every regain that became a shot, in the team's frame, for the map and the clip list."""
    out = []
    for side, g, flip in (("won", w, False), ("conceded", c, True)):
        for r in g[g.shot].sort_values(["date", "period", "minute", "second"]).itertuples():
            x, y, sx, sy = r.x, r.y, r.sx, r.sy
            if flip:
                x, y, sx, sy = PITCH_X - x, PITCH_Y - y, PITCH_X - sx, PITCH_Y - sy
            out.append({
                "side": side, "date": r.date, "opp": r.opponent if side == "won" else r.team,
                "home": bool(r.home) if side == "won" else not r.home,
                "period": int(r.period), "min": int(r.minute), "sec": int(r.second),
                "player": r.player, "shooter": r.shooter, "kind": r.kind,
                "x": round(x, 1), "y": round(y, 1), "sx": round(sx, 1), "sy": round(sy, 1),
                "xg": round(float(r.xg), 3), "goal": bool(r.goal),
            })
    return out


def players(w, top=8):
    """Who wins the ball for this team, and whose regains turn into chances."""
    g = w.groupby("player").agg(n=("x", "size"), high=("x", lambda v: int((v >= PITCH_X / 2).sum())),
                                shots=("shot", "sum"), xg=("xg", "sum"))
    g = g.sort_values("n", ascending=False).head(top)
    return [{"name": n, "n": int(r.n), "high": int(r.high), "shots": int(r.shots), "xg": round(float(r.xg), 2)}
            for n, r in g.iterrows()]


def game_states(g, state_col, league_by_state):
    out = []
    for st in STATES:
        s = zone_stats(g[g[state_col] == st])
        lg = league_by_state[st]
        s.update(state=st, league_xg_per=lg["xg_per"], low_n=s["n"] < MIN_N)
        s["clear_gap"] = bool(s["se"]) and s["n"] >= MIN_N and abs(s["xg_per"] - lg["xg_per"]) > 1.96 * s["se"]
        out.append(s)
    return out


def state_note(states):
    """Game state is the biggest confounder: teams counter more when leading. Show it."""
    ok = [st for st in states if not st["low_n"]]
    if len(ok) < 2:
        return None
    best = max(ok, key=lambda st: st["xg_per"])
    worst = min(ok, key=lambda st: st["xg_per"])
    if best is worst or not worst["xg_per"]:
        return None
    return {"kind": "good", "title": "Score changes the picture",
            "text": f"Your regains were worth most when <b>{best['state'].lower()}</b>: {best['xg_per']:.3f} xG each "
                    f"over {best['n']} regains, against {worst['xg_per']:.3f} when {worst['state'].lower()}. "
                    f"Versus the league in the same game state, that is {vs_league(best, 'game state')}. "
                    f"So part of any zone pattern may reflect the score, not the press itself."}


def build(root, out_path):
    matches, df = load(root)
    n_total = len(matches)

    league_won = []
    for col in range(COLS):
        for row in range(ROWS):
            league_won.append(zone_stats(df[(df.col == col) & (df.row == row)]))

    league_state = {st: zone_stats(df[df.state == st]) for st in STATES}
    # A team trailing when it loses the ball means the regaining side is leading.
    league_state_conc = {st: zone_stats(df[df.state == FLIP_STATE[st]]) for st in STATES}

    team_matches = {}
    for m in matches:
        for side in ("home_team", "away_team"):
            name = m[side][f"{side}_name"]
            team_matches[name] = team_matches.get(name, 0) + 1

    teams = []
    for team in sorted(team_matches):
        n_m = team_matches[team]
        w, c = df[df.team == team], df[df.opponent == team]
        won = zone_table(w, "col", "row", league_won)
        # League baseline for conceded zones is the won table seen from the other end.
        league_conceded = [league_won[(COLS - 1 - col) * ROWS + (ROWS - 1 - row)]
                           for col in range(COLS) for row in range(ROWS)]
        conceded = zone_table(c, "col_lost", "row_lost", league_conceded)
        c = c.assign(state_team=c["state"].map(FLIP_STATE))
        style = {
            "high_per_match": round(float((w.x >= PITCH_X / 2).sum()) / n_m, 2),
            "high_share": round(float((w.x >= PITCH_X / 2).mean()), 4),
            "xg_per": round(float(w.xg.mean()), 4),
            "conceded_xg_per": round(float(c.xg.mean()), 4),
        }
        teams.append({
            "name": team, "matches": n_m, "style": style,
            "chains": chains(w, c), "players": players(w),
            "states": {"won": game_states(w, "state", league_state),
                       "conceded": game_states(c, "state_team", league_state_conc)},
            "won": {"totals": totals(w, n_m, "col", df), "zones": won},
            "conceded": {"totals": totals(c, n_m, "col_lost", df), "zones": conceded},
            "summary": summarise(team, won, conceded, totals(w, n_m, "col", df)["thirds"], n_m),
        })

    for t in teams:
        note = state_note(t["states"]["won"])
        if note:
            t["summary"].insert(len(t["summary"]) - 1, note)

    # League ranks for headline numbers (1 = best).
    for key, side, rev in [("xg_won", "won", True), ("xg_conceded", "conceded", False)]:
        order = sorted(teams, key=lambda t: t[side]["totals"]["xg"], reverse=rev)
        for i, t in enumerate(order):
            t.setdefault("ranks", {})[key] = i + 1

    out = {
        "meta": {
            "competition": "Premier League", "season": "2015/16", "matches": n_total,
            "turnovers": len(df), "generated": date.today().isoformat(),
            "cols": COLS, "rows": ROWS, "zone_w": ZONE_W, "zone_h": ZONE_H,
            "shot_window_s": SHOT_WINDOW_S, "min_n": MIN_N,
            "source": "StatsBomb Open Data", "source_url": "https://github.com/statsbomb/open-data",
        },
        "league": {"won": league_won},
        "teams": teams,
    }
    out_path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"{len(df)} regains across {n_total} matches -> {out_path} ({out_path.stat().st_size // 1024} KB)")
    return df


if __name__ == "__main__":
    here = Path(__file__).resolve().parent.parent
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else here / "data/statsbomb"
    build(root, here / "web/public/results.json")
