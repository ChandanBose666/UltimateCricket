/**
 * The toss screen. One phase-driven screen — no navigation dependency.
 *
 * House rules being honoured here:
 *  - No cricket or toss rules live in this file. Every legality question goes
 *    to `isValidToss()`; this file only renders and disables.
 *  - Illegal actions are DISABLED BUTTONS, never error toasts (plan §7).
 *  - There is no control anywhere below that edits a confirmed decision
 *    (Law 13.5). The COMPLETE section is read-only by construction.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Big, Card, Choice, Field, Primary, Row, s as c } from './components';
import { CREAM, INK, LIME, LINE, MUTED } from './theme';
import { getTossState, useTossState, useTossStore } from '../store/tossStore';
import { coinFromNonce, commitFor, shortHash } from '../toss/commit';
import { battingFirst, isCaptainsConfirmFallback, tossSummary, umpires } from '../toss/derive';
import { nowMs, randomNonce } from '../toss/entropy';
import { isValidToss } from '../toss/validate';
import type { Actor, OfficialRole, TossState } from '../toss/types';

const OFFICIAL_FIELDS: { role: OfficialRole; label: string; hint: string }[] = [
  { role: 'UMPIRE_1', label: 'Umpire 1', hint: 'Optional — leave blank for captains-confirm' },
  { role: 'UMPIRE_2', label: 'Umpire 2', hint: 'Optional' },
  { role: 'SCORER', label: 'Scorer', hint: 'Optional — does not witness the toss' },
];

/** Whoever holds the umpire's authority: the assigned umpire, else both captains. */
function officialActor(s: TossState): Actor {
  const ump = umpires(s);
  const first = ump[0];
  return first ? { kind: 'UMPIRE', role: first.role } : { kind: 'BOTH_CAPTAINS' };
}

function officialLabel(s: TossState): string {
  return umpires(s)[0]?.name ?? 'Both captains';
}

export default function TossScreen() {
  const s = useTossState();
  const home = useTossStore((st) => st.home);
  const away = useTossStore((st) => st.away);
  const pendingNonce = useTossStore((st) => st.pendingNonce);
  const dispatch = useTossStore((st) => st.dispatch);
  const setPendingNonce = useTossStore((st) => st.setPendingNonce);
  const setTeamName = useTossStore((st) => st.setTeamName);

  const [draft, setDraft] = useState<Record<OfficialRole, string>>({
    UMPIRE_1: '',
    UMPIRE_2: '',
    SCORER: '',
  });

  const names = { [home.id]: home.name, [away.id]: away.name };
  const teamName = (id: string | null) => (id ? (names[id] ?? id) : '');

  const startToss = () => {
    for (const { role } of OFFICIAL_FIELDS) {
      const name = draft[role].trim();
      if (name !== '') {
        dispatch({
          type: 'ASSIGN_OFFICIAL',
          actor: { kind: 'BOTH_CAPTAINS' },
          official: { role, name },
        });
      }
    }
    // Officials are in the log now, so the actor resolves against them.
    const fresh = getTossState();
    const actor = officialActor(fresh);

    if (fresh.method === 'DIGITAL') {
      const nonce = randomNonce();
      setPendingNonce(nonce);
      dispatch({ type: 'START_TOSS', actor, commitHash: commitFor(nonce) });
    } else {
      dispatch({ type: 'START_TOSS', actor });
    }
  };

  const draftHasUmpire =
    draft.UMPIRE_1.trim() !== '' || draft.UMPIRE_2.trim() !== '';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>THE TOSS · MCC LAW 13</Text>
          <Text style={styles.title}>
            {home.name} <Text style={styles.v}>v</Text> {away.name}
          </Text>
          <Text style={styles.phase}>{phaseLabel(s)}</Text>
        </View>

        {/* ---------------------------------------------------- SETUP ---- */}
        {s.phase === 'SETUP' && (
          <>
            <Card title="Sides">
              <Field
                label="Home side — tosses the coin"
                value={home.name}
                onChangeText={(t) => setTeamName('home', t)}
              />
              <Field
                label="Visiting side — calls"
                value={away.name}
                onChangeText={(t) => setTeamName('away', t)}
              />
            </Card>

            <Card title="Method">
              <View style={c.row}>
                <Choice
                  label="Physical coin"
                  sub="A real coin, two taps"
                  selected={s.method === 'PHYSICAL_COIN'}
                  onPress={() =>
                    dispatch({
                      type: 'SET_METHOD',
                      actor: { kind: 'BOTH_CAPTAINS' },
                      method: 'PHYSICAL_COIN',
                    })
                  }
                />
                <Choice
                  label="Digital"
                  sub="Commit–reveal, provable"
                  selected={s.method === 'DIGITAL'}
                  onPress={() =>
                    dispatch({
                      type: 'SET_METHOD',
                      actor: { kind: 'BOTH_CAPTAINS' },
                      method: 'DIGITAL',
                    })
                  }
                />
              </View>
            </Card>

            <Card title="Match officials">
              {OFFICIAL_FIELDS.map((f) => (
                <Field
                  key={f.role}
                  label={f.label}
                  hint={f.hint}
                  value={draft[f.role]}
                  placeholder="Name"
                  onChangeText={(t) => setDraft((d) => ({ ...d, [f.role]: t }))}
                />
              ))}
              <Text style={styles.note}>
                {draftHasUmpire
                  ? 'Law 13.4 — the umpire starts, witnesses and confirms the toss.'
                  : 'No umpire assigned. Both captains will confirm together — normal in gully and school cricket.'}
              </Text>
            </Card>

            <Primary label="Start the toss" onPress={startToss} disabled={home.name.trim() === '' || away.name.trim() === ''} />
            <Text style={styles.actorNote}>
              {draftHasUmpire
                ? `${draft.UMPIRE_1.trim() || draft.UMPIRE_2.trim()} starts the toss`
                : 'Both captains start the toss together'}
            </Text>
          </>
        )}

        {/* ---------------------------------------- DIGITAL: THE CALL ---- */}
        {s.phase === 'AWAITING_CALL' && (
          <>
            <Card title="Committed before the call">
              <Text style={styles.hashBig}>{shortHash(s.commitHash ?? '')}</Text>
              <Text style={styles.hashFull}>{s.commitHash}</Text>
              <Text style={styles.note}>
                The coin is already decided and sealed behind this hash. It is published now,
                before the call — so the result cannot be chosen after hearing it.
              </Text>
            </Card>

            <Card title={`${away.name} calls`}>
              <View style={c.row}>
                {(['HEADS', 'TAILS'] as const).map((face) => (
                  <Big
                    key={face}
                    label={face}
                    onPress={() =>
                      dispatch({
                        type: 'RECORD_CALL',
                        actor: { kind: 'CAPTAIN', teamId: away.id },
                        call: face,
                      })
                    }
                    disabled={
                      !isValidToss(s, {
                        type: 'RECORD_CALL',
                        actor: { kind: 'CAPTAIN', teamId: away.id },
                        call: face,
                      })
                    }
                  />
                ))}
              </View>
            </Card>
          </>
        )}

        {/* -------------------------------------------- DIGITAL: REVEAL -- */}
        {s.phase === 'AWAITING_REVEAL' && (
          <Card title={`${away.name} called ${s.call}`}>
            <Text style={styles.note}>
              {isCaptainsConfirmFallback(s)
                ? 'Both captains now reveal the nonce, together.'
                : `${officialLabel(s)} now reveals the nonce.`}{' '}
              Anyone can re-hash it and check it against the commit above.
            </Text>
            <Primary
              label="Reveal the coin"
              disabled={pendingNonce === null}
              onPress={() => {
                if (pendingNonce === null) return;
                dispatch({ type: 'REVEAL', actor: officialActor(s), nonce: pendingNonce });
              }}
            />
            {pendingNonce === null && (
              <Text style={styles.note}>
                The nonce for this toss is missing, so it cannot be revealed. Reset and toss again.
              </Text>
            )}
          </Card>
        )}

        {/* --------------------------------------- PHYSICAL: WHO WON ----- */}
        {s.phase === 'AWAITING_OUTCOME' && (
          <Card title="Who won the toss?">
            <Text style={styles.note}>
              {isCaptainsConfirmFallback(s)
                ? 'Both captains record what the coin did, together.'
                : `${officialLabel(s)} records what the coin did in front of both captains.`}
            </Text>
            <View style={c.row}>
              {[home, away].map((t) => (
                <Big
                  key={t.id}
                  label={t.name}
                  onPress={() =>
                    dispatch({ type: 'RECORD_OUTCOME', actor: officialActor(s), wonBy: t.id })
                  }
                  disabled={
                    !isValidToss(s, {
                      type: 'RECORD_OUTCOME',
                      actor: officialActor(s),
                      wonBy: t.id,
                    })
                  }
                />
              ))}
            </View>
          </Card>
        )}

        {/* ------------------------------------------------- DECISION ---- */}
        {(s.phase === 'AWAITING_DECISION' || s.phase === 'AWAITING_CONFIRMATION') && (
          <>
            {s.result !== null && (
              <Card title="The coin">
                <Text style={styles.coin}>{s.result}</Text>
                <Text style={styles.note}>
                  {away.name} called {s.call}. {teamName(s.wonBy)} won the toss.
                </Text>
              </Card>
            )}

            <Card title={`${teamName(s.wonBy)} — bat or field?`}>
              <View style={c.row}>
                {(['BAT', 'FIELD'] as const).map((d) => (
                  <Big
                    key={d}
                    label={d}
                    selected={s.decision === d}
                    onPress={() =>
                      dispatch({
                        type: 'RECORD_DECISION',
                        actor: { kind: 'CAPTAIN', teamId: s.wonBy ?? '' },
                        decision: d,
                      })
                    }
                    disabled={
                      !isValidToss(s, {
                        type: 'RECORD_DECISION',
                        actor: { kind: 'CAPTAIN', teamId: s.wonBy ?? '' },
                        decision: d,
                      })
                    }
                  />
                ))}
              </View>
              <Text style={styles.note}>
                Changeable until it is confirmed. After that, Law 13.5 fixes it for good.
              </Text>
            </Card>
          </>
        )}

        {/* --------------------------------------------- CONFIRMATION ---- */}
        {s.phase === 'AWAITING_CONFIRMATION' && (
          <Card title="Confirm">
            <Text style={styles.confirmLine}>
              {teamName(s.wonBy)} won the toss and elected to{' '}
              {s.decision === 'BAT' ? 'bat' : 'field'}.
            </Text>
            <Text style={styles.note}>
              {isCaptainsConfirmFallback(s)
                ? 'Both captains confirm together. This cannot be undone.'
                : `${officialLabel(s)} confirms. This cannot be undone.`}
            </Text>
            <Primary
              label={isCaptainsConfirmFallback(s) ? 'Both captains confirm' : 'Umpire confirms'}
              onPress={() => dispatch({ type: 'CONFIRM', actor: officialActor(s), at: nowMs() })}
              disabled={!isValidToss(s, { type: 'CONFIRM', actor: officialActor(s), at: nowMs() })}
            />
          </Card>
        )}

        {/* --------------------------------------------- COMPLETE -------- */}
        {s.phase === 'COMPLETE' && s.record !== null && (
          <>
            <Card title="Toss complete">
              <Text style={styles.summary}>{tossSummary(s.record, names)}</Text>
              <Text style={styles.note}>{teamName(battingFirst(s))} bats first.</Text>
            </Card>

            {s.record.nonce !== undefined && s.record.commitHash !== undefined && (
              <Card title="Verify it yourself">
                <Row k="Committed" v={s.record.commitHash} mono />
                <Row k="Nonce" v={s.record.nonce} mono />
                <Row k="Re-hashed" v={commitFor(s.record.nonce)} mono />
                <Row
                  k="Match"
                  v={commitFor(s.record.nonce) === s.record.commitHash ? 'YES' : 'NO'}
                />
                <Row k="Coin" v={coinFromNonce(s.record.nonce)} />
                <Text style={styles.note}>
                  The commit was published before the call. The nonce re-hashes to it, so the
                  coin was fixed in advance.
                </Text>
              </Card>
            )}

            <Card title="Record">
              <Row k="Method" v={s.record.method === 'DIGITAL' ? 'Digital' : 'Physical coin'} />
              <Row k="Tossed by" v={teamName(s.record.tossedBy)} />
              <Row k="Called by" v={teamName(s.record.calledBy)} />
              {s.record.call !== undefined && <Row k="Call" v={s.record.call} />}
              {s.record.result !== undefined && <Row k="Result" v={s.record.result} />}
              <Row k="Won by" v={teamName(s.record.wonBy)} />
              <Row k="Decision" v={s.record.decision} />
              <Row
                k="Witnessed by"
                v={
                  s.record.witnessedBy.length === 0
                    ? 'Both captains (no umpire)'
                    : s.record.witnessedBy.map((o) => `${o.name} (${o.role})`).join(', ')
                }
              />
              <Text style={styles.locked}>
                Law 13.5 — once notified, the decision cannot be changed. There is no edit
                control on this screen.
              </Text>
            </Card>
          </>
        )}

      </ScrollView>
    </View>
  );
}

function phaseLabel(s: TossState): string {
  switch (s.phase) {
    case 'SETUP':
      return 'Before the toss';
    case 'AWAITING_CALL':
      return 'Committed — waiting for the call';
    case 'AWAITING_REVEAL':
      return 'Called — ready to reveal';
    case 'AWAITING_OUTCOME':
      return 'Coin tossed — record the result';
    case 'AWAITING_DECISION':
      return 'Won — bat or field?';
    case 'AWAITING_CONFIRMATION':
      return 'Awaiting the umpire';
    case 'COMPLETE':
      return 'Settled';
  }
}

// --------------------------------------------------------------- styles ---
// Shared pieces (Card, Field, Primary, Big, Choice, Row) live in ./components.

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  scroll: { padding: 20, paddingBottom: 64, maxWidth: 560, width: '100%', alignSelf: 'center' },

  header: { paddingTop: 32, paddingBottom: 20 },
  eyebrow: { color: LIME, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: CREAM, fontSize: 30, fontWeight: '800', marginTop: 8 },
  v: { color: MUTED, fontWeight: '400' },
  phase: { color: MUTED, fontSize: 14, marginTop: 6 },

  note: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 10 },
  actorNote: { color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 10 },

  hashBig: { color: LIME, fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  hashFull: { color: '#5f7a6d', fontSize: 10, marginTop: 6 },

  coin: { color: LIME, fontSize: 40, fontWeight: '800' },
  confirmLine: { color: CREAM, fontSize: 18, fontWeight: '700', lineHeight: 26 },
  summary: { color: CREAM, fontSize: 18, fontWeight: '700', lineHeight: 26 },

  locked: { color: LIME, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
