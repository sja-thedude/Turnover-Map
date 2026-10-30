"""Tests for the turnover pipeline and the precomputed results.json.

Run from the repo root:  python -m pytest analysis
"""

import json
import math
import re
from pathlib import Path

import pytest

import build

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "web/public/results.json"
RAW = ROOT / "data/statsbomb"

A, B = "Team A", "Team B"


class Match:
    """Builds a minimal StatsBomb-shaped event list."""

    def __init__(self):
        self.events = []
        self.poss = 0

    def possession(self, team, pattern="Regular Play"):
        self.poss += 1
        self.team, self.pattern = team, pattern
        return self

    def ev(self, kind, team, t, loc=(60, 40), period=1, **extra):
        e = {
            "index": len(self.events) + 1, "period": period,
            "timestamp": f"00:{int(t // 60):02d}:{t % 60:06.3f}", "minute": int(t // 60), "second": int(t % 60),
            "type": {"name": kind}, "possession": self.poss, "possession_team": {"name": self.team},
            "play_pattern": {"name": self.pattern}, "team": {"name": team},
            "location": list(loc), "player": {"id": 1, "name": f"{team} player"},
        }
        e.update(extra)
        self.events.append(e)
        return self

    def shot(self, team, t, xg, goal=False, kind="Open Play", loc=(105, 40)):
        return self.ev("Shot", team, t, loc, shot={
            "statsbomb_xg": xg, "type": {"name": kind},
            "outcome": {"name": "Goal" if goal else "Saved"},
        })


def interception(m, team, t, loc):
    return m.ev("Interception", team, t, loc, interception={"outcome": {"name": "Won"}})


# --- geometry -----------------------------------------------------------------

@pytest.mark.parametrize("x,y,zone", [
    (0, 0, (0, 0)), (19.9, 19.9, (0, 0)), (20, 20, (1, 1)),
    (119.9, 79.9, (5, 3)), (120, 80, (5, 3)),  # the far touchline belongs to the last zone
    (60, 40, (3, 2)),
])
def test_zone_of(x, y, zone):
    assert build.zone_of(x, y) == zone


def test_zone_labels():
    assert build.zone_label(0, 0) == "A1"
    assert build.zone_label(5, 3) == "F4"
    assert build.zone_name(5, 0) == "left wing, opposition box"


# --- regain detection -----------------------------------------------------------

def test_winning_actions():
    tackle = {"type": {"name": "Duel"}, "duel": {"type": {"name": "Tackle"}, "outcome": {"name": "Won"}}}
    lost = {"type": {"name": "Duel"}, "duel": {"type": {"name": "Tackle"}, "outcome": {"name": "Lost Out"}}}
    failed = {"type": {"name": "Ball Recovery"}, "ball_recovery": {"recovery_failure": True}}
    assert build.winning_action(tackle) == "Tackle"
    assert build.winning_action(lost) is None
    assert build.winning_action({"type": {"name": "Ball Recovery"}}) == "Recovery"
    assert build.winning_action(failed) is None
    assert build.winning_action({"type": {"name": "Pass"}}) is None


def test_interception_in_opponent_possession_sets_location_and_type():
    m = Match()
    m.possession(B).ev("Pass", B, 10, (40, 40))
    interception(m, A, 11, (70, 30))                # logged inside B's possession
    m.possession(A).ev("Pass", A, 11.5, (72, 31))
    rows = build.match_turnovers(m.events, 1)
    assert len(rows) == 1
    r = rows[0]
    assert (r["team"], r["opponent"], r["kind"]) == (A, B, "Interception")
    assert (r["x"], r["y"]) == (70, 30)
    assert not r["shot"] and r["xg"] == 0


def test_shot_inside_window_counts_and_outside_does_not():
    m = Match()
    m.possession(B).ev("Pass", B, 0)
    m.possession(A).ev("Ball Recovery", A, 5).shot(A, 14.9, 0.3)
    m.possession(B).ev("Pass", B, 30)
    m.possession(A).ev("Ball Recovery", A, 40).shot(A, 50.5, 0.3)
    rows = [r for r in build.match_turnovers(m.events, 1) if r["team"] == A]
    assert [r["shot"] for r in rows] == [True, False]


def test_xg_combines_as_probability_of_at_least_one_goal():
    m = Match()
    m.possession(B).ev("Pass", B, 0)
    m.possession(A).ev("Ball Recovery", A, 5).shot(A, 7, 0.5).shot(A, 8, 0.5, goal=True)
    (r,) = build.match_turnovers(m.events, 1)
    assert math.isclose(r["xg"], 0.75)
    assert r["goal"]


def test_penalties_are_excluded():
    m = Match()
    m.possession(B).ev("Pass", B, 0)
    m.possession(A).ev("Ball Recovery", A, 5).shot(A, 9, 0.78, kind="Penalty")
    (r,) = build.match_turnovers(m.events, 1)
    assert not r["shot"]


@pytest.mark.parametrize("pattern", ["From Throw In", "From Corner", "From Free Kick", "From Goal Kick", "From Kick Off", "From Keeper"])
def test_set_pieces_and_restarts_are_not_regains(pattern):
    m = Match()
    m.possession(B).ev("Pass", B, 0)
    m.possession(A, pattern).ev("Pass", A, 5)
    assert build.match_turnovers(m.events, 1) == []


def test_same_team_consecutive_possessions_are_not_regains():
    m = Match()
    m.possession(A).ev("Pass", A, 0)
    m.possession(A).ev("Pass", A, 5)
    assert build.match_turnovers(m.events, 1) == []


def test_game_state_is_from_the_regaining_team_view():
    m = Match()
    m.possession(B).ev("Pass", B, 0).shot(B, 1, 0.4, goal=True)   # B lead 1-0
    m.possession(A).ev("Ball Recovery", A, 5)
    m.possession(B).ev("Ball Recovery", B, 20)
    states = {r["team"]: r["state"] for r in build.match_turnovers(m.events, 1)}
    assert states == {A: "Trailing", B: "Leading"}


def test_pressure_flag():
    m = Match()
    m.possession(B).ev("Pass", B, 0).ev("Pressure", A, 8)
    m.possession(A).ev("Ball Recovery", A, 10)
    (r,) = build.match_turnovers(m.events, 1)
    assert r["pressed"]


def test_shot_in_next_period_does_not_count():
    m = Match()
    m.possession(B).ev("Pass", B, 2700)
    m.possession(A).ev("Ball Recovery", A, 2705).ev("Shot", A, 1, period=2, shot={
        "statsbomb_xg": 0.5, "type": {"name": "Open Play"}, "outcome": {"name": "Saved"}})
    (r,) = build.match_turnovers(m.events, 1)
    assert not r["shot"]


# --- summary wording --------------------------------------------------------------

def zone(**kw):
    z = dict(n=50, shots=5, goals=0, xg=1.0, xg_per=0.02, se=0.005, shot_rate=0.1, pressed_rate=0.5,
             col=3, row=1, label="D2", name="left-centre, opposition half", low_n=False,
             league_xg_per=0.01, vs_league=0.01, clear_gap=True)
    z.update(kw)
    return z


def test_vs_league_wording():
    assert "2.0x" in build.vs_league(zone()) and "larger than chance" in build.vs_league(zone())
    assert "within normal variation" in build.vs_league(zone(clear_gap=False))
    assert build.vs_league(zone(xg_per=0.0101, clear_gap=False)) == "about the league average for that zone"
    assert "below par" in build.vs_league(zone(xg_per=0.005))


def test_summary_never_uses_low_sample_zones():
    won = [zone(label="D1", low_n=True, n=5, xg_per=0.5), zone(label="D2")]
    conceded = [zone(label="C1", low_n=True, n=4, xg=9.0), zone(label="C2", xg=1.0)]
    thirds = [zone(name="Defensive third"), zone(name="Middle third"), zone(name="Attacking third")]
    text = " ".join(n["text"] for n in build.summarise("X", won, conceded, thirds, 38))
    assert "<b>D1</b>" not in text and "<b>C1</b>" not in text
    assert "<b>D2</b>" in text and "<b>C2</b>" in text


def test_no_wasteful_zone_claimed_when_all_zones_beat_league():
    won = [zone(label="D2"), zone(label="C2", col=2)]
    thirds = [zone()] * 3
    notes = build.summarise("X", won, [], thirds, 38)
    bad = next(n for n in notes if n["kind"] == "bad")
    assert "no clear dead zone" in bad["text"]


def test_plural():
    assert build.plural(1, "goal") == "1 goal"
    assert build.plural(0, "goal") == "0 goals"


# --- results.json invariants ----------------------------------------------------

@pytest.fixture(scope="module")
def results():
    return json.loads(RESULTS.read_text())


def test_shape(results):
    m = results["meta"]
    assert m["matches"] == 380 and m["min_n"] == build.MIN_N
    assert len(results["teams"]) == 20
    assert len(results["league"]["won"]) == 24
    for t in results["teams"]:
        assert t["matches"] == 38
        assert len(t["won"]["zones"]) == 24 and len(t["conceded"]["zones"]) == 24
        assert sorted(z["label"] for z in t["won"]["zones"]) == sorted(
            f"{c}{r}" for c in "ABCDEF" for r in range(1, 5))


def test_every_turnover_is_counted_once_each_side(results):
    total = results["meta"]["turnovers"]
    assert sum(t["won"]["totals"]["n"] for t in results["teams"]) == total
    assert sum(t["conceded"]["totals"]["n"] for t in results["teams"]) == total
    assert sum(z["n"] for z in results["league"]["won"]) == total
    for t in results["teams"]:
        for side in ("won", "conceded"):
            s = t[side]
            assert sum(z["n"] for z in s["zones"]) == s["totals"]["n"]
            assert sum(z["shots"] for z in s["zones"]) == s["totals"]["shots"]
            assert math.isclose(sum(z["xg"] for z in s["zones"]), s["totals"]["xg"], abs_tol=0.05)
            assert sum(th["n"] for th in s["totals"]["thirds"]) == s["totals"]["n"]
        assert sum(st["n"] for st in t["states"]["won"]) == t["won"]["totals"]["n"]
        assert sum(st["n"] for st in t["states"]["conceded"]) == t["conceded"]["totals"]["n"]


def test_league_zone_is_sum_of_team_zones(results):
    for i, lg in enumerate(results["league"]["won"]):
        assert lg["n"] == sum(t["won"]["zones"][i]["n"] for t in results["teams"])


def test_conceded_is_mirror_of_opponents_won(results):
    # Total won in zone (c, r) across teams equals total conceded in the flipped zone.
    for c in range(6):
        for r in range(4):
            won = sum(t["won"]["zones"][c * 4 + r]["n"] for t in results["teams"])
            conc = sum(t["conceded"]["zones"][(5 - c) * 4 + (3 - r)]["n"] for t in results["teams"])
            assert won == conc


def test_low_n_flags_and_rates(results):
    for t in results["teams"]:
        for side in ("won", "conceded"):
            for z in t[side]["zones"]:
                assert z["low_n"] == (z["n"] < build.MIN_N)
                assert 0 <= z["shot_rate"] <= 1 and z["shots"] <= z["n"] and z["goals"] <= z["shots"]
                if z["low_n"]:
                    assert not z["clear_gap"]


def test_no_unformatted_placeholders(results):
    notes = "".join(n["text"] for t in results["teams"] for n in t["summary"])
    assert "{" not in notes and "}" not in notes
    # json.dump writes float NaN/inf as bare tokens, which browsers reject.
    raw = RESULTS.read_text()
    assert not re.search(r"[:,\[](NaN|-?Infinity)\b", raw)


def test_summaries_only_cite_well_sampled_zones(results):
    for t in results["teams"]:
        low = {(side, z["label"]) for side in ("won", "conceded") for z in t[side]["zones"] if z["low_n"]}
        for note in t["summary"]:
            cited = re.findall(r"<b>([A-F][1-4])</b>", note["text"])
            side = "conceded" if note["kind"] == "warn" else "won"
            for label in cited:
                assert (side, label) not in low, f"{t['name']}: {note['title']} cites low-n zone {label}"
        assert t["summary"][-1]["kind"] == "note" and "not proof" in t["summary"][-1]["text"]


def test_chains_match_shot_counts(results):
    for t in results["teams"]:
        for side in ("won", "conceded"):
            chains = [c for c in t["chains"] if c["side"] == side]
            assert len(chains) == t[side]["totals"]["shots"]
            assert sum(c["goal"] for c in chains) == t[side]["totals"]["goals"]
            for c in chains:
                assert 0 <= c["x"] <= 120 and 0 <= c["y"] <= 80 and 0 < c["xg"] <= 1


def test_ranks_are_a_permutation(results):
    for key in ("xg_won", "xg_conceded"):
        assert sorted(t["ranks"][key] for t in results["teams"]) == list(range(1, 21))


# --- real data (skipped when the raw StatsBomb files are not present) -----------

needs_raw = pytest.mark.skipif(not (RAW / "data/events").exists(), reason="StatsBomb raw data not downloaded")


@needs_raw
def test_known_match_man_city_1_3_leicester():
    matches = json.loads((RAW / "data/matches/2/27.json").read_text())
    m = next(m for m in matches if m["match_date"] == "2016-02-06"
             and m["home_team"]["home_team_name"] == "Manchester City")
    assert (m["home_score"], m["away_score"], m["away_team"]["away_team_name"]) == (1, 3, "Leicester City")
    events = json.loads((RAW / f"data/events/{m['match_id']}.json").read_text())
    rows = build.match_turnovers(events, m["match_id"])
    # The four goals came from a free kick, a dribble, a corner and late pressure: none is a regain goal.
    assert not any(r["goal"] for r in rows)
    assert {r["team"] for r in rows} == {"Manchester City", "Leicester City"}
    assert 40 <= len(rows) <= 90
