/**
 * Between innings and the first ball: how long, who opens, who bowls.
 *
 * Which side bats is NOT chosen here. In the first innings it comes from the
 * toss record via `battingFirst()` — Law 13.5 means there is no path back to
 * change it. In the second it is simply the other side.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { otherSide, useMatch, useMatchStore, type Side } from '../store/matchStore';
import { useTossState, useTossStore } from '../store/tossStore';
import { battingFirst } from '../toss/derive';
import { Card, Pill, Primary, s as c } from './components';
import { CREAM, INK, LIME, MUTED } from './theme';

const OVERS_OPTIONS = [5, 10, 20];

export default function InningsSetupScreen() {
  const toss = useTossState();
  const { innings, oversLimit: currentOvers } = useMatch();
  const home = useTossStore((st) => st.home);
  const away = useTossStore((st) => st.away);

  const homeSquad = useMatchStore((st) => st.homeSquad);
  const awaySquad = useMatchStore((st) => st.awaySquad);
  const startInnings = useMatchStore((st) => st.startInnings);

  const [overs, setOvers] = useState(currentOvers);
  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);

  const isFirstInnings = innings.length === 0;
  const first = innings[0];

  const battingSide: Side = isFirstInnings
    ? battingFirst(toss) === home.id
      ? 'home'
      : 'away'
    : otherSide(first!.record.battingSide);

  const squadFor = (side: Side) => (side === 'home' ? homeSquad : awaySquad);
  const nameFor = (side: Side) => (side === 'home' ? home.name : away.name);

  const battingSquad = squadFor(battingSide);
  const bowlingSquad = squadFor(otherSide(battingSide));

  const ready = strikerId !== null && nonStrikerId !== null && bowlerId !== null;
  const target = first !== undefined ? first.state.runs + 1 : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{isFirstInnings ? 'INNINGS 1' : 'INNINGS 2'}</Text>
          <Text style={styles.title}>{nameFor(battingSide)} batting</Text>
          <Text style={styles.sub}>
            {nameFor(otherSide(battingSide))} in the field
            {target !== null ? ` · chasing ${target}` : ''}
          </Text>
        </View>

        {isFirstInnings && (
          <Card title="Overs">
            <View style={c.wrap}>
              {OVERS_OPTIONS.map((o) => (
                <Pill
                  key={o}
                  label={`${o} overs`}
                  selected={overs === o}
                  onPress={() => setOvers(o)}
                />
              ))}
            </View>
          </Card>
        )}

        <Card title="Striker">
          <View style={c.wrap}>
            {battingSquad.map((p) => (
              <Pill
                key={p.id}
                label={p.name}
                selected={strikerId === p.id}
                disabled={nonStrikerId === p.id}
                onPress={() => setStrikerId(p.id)}
              />
            ))}
          </View>
        </Card>

        <Card title="Non-striker">
          <View style={c.wrap}>
            {battingSquad.map((p) => (
              <Pill
                key={p.id}
                label={p.name}
                selected={nonStrikerId === p.id}
                disabled={strikerId === p.id}
                onPress={() => setNonStrikerId(p.id)}
              />
            ))}
          </View>
        </Card>

        <Card title="Opening bowler">
          <View style={c.wrap}>
            {bowlingSquad.map((p) => (
              <Pill
                key={p.id}
                label={p.name}
                selected={bowlerId === p.id}
                onPress={() => setBowlerId(p.id)}
              />
            ))}
          </View>
        </Card>

        <Primary
          label={isFirstInnings ? 'Start the innings' : 'Start the chase'}
          disabled={!ready}
          onPress={() => {
            if (strikerId === null || nonStrikerId === null || bowlerId === null) return;
            startInnings(
              battingSide,
              { strikerId, nonStrikerId, bowlerId },
              isFirstInnings ? overs : undefined,
            );
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  scroll: { padding: 20, paddingBottom: 64, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { paddingTop: 32, paddingBottom: 20 },
  eyebrow: { color: LIME, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: CREAM, fontSize: 28, fontWeight: '800', marginTop: 8 },
  sub: { color: MUTED, fontSize: 14, marginTop: 6 },
});
