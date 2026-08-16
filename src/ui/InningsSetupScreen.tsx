/**
 * Between the toss and the first ball: how long, who opens, who bowls.
 *
 * Which side bats is NOT chosen here — it comes from the toss record via
 * `battingFirst()`. Law 13.5 means there is no path back to change it.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useMatchStore } from '../store/matchStore';
import { useTossState, useTossStore } from '../store/tossStore';
import { battingFirst } from '../toss/derive';
import { Card, Pill, Primary, s as c } from './components';
import { CREAM, INK, LIME, MUTED } from './theme';

const OVERS_OPTIONS = [5, 10, 20];

export default function InningsSetupScreen() {
  const toss = useTossState();
  const home = useTossStore((st) => st.home);
  const away = useTossStore((st) => st.away);

  const homeSquad = useMatchStore((st) => st.homeSquad);
  const awaySquad = useMatchStore((st) => st.awaySquad);
  const startInnings = useMatchStore((st) => st.startInnings);

  const [overs, setOvers] = useState(5);
  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);

  const battingTeamId = battingFirst(toss);
  const battingSide: 'home' | 'away' = battingTeamId === home.id ? 'home' : 'away';
  const battingSquad = battingSide === 'home' ? homeSquad : awaySquad;
  const bowlingSquad = battingSide === 'home' ? awaySquad : homeSquad;
  const battingName = battingSide === 'home' ? home.name : away.name;
  const bowlingName = battingSide === 'home' ? away.name : home.name;

  const ready = strikerId !== null && nonStrikerId !== null && bowlerId !== null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>INNINGS 1</Text>
          <Text style={styles.title}>{battingName} batting</Text>
          <Text style={styles.sub}>{bowlingName} in the field</Text>
        </View>

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
          label="Start the innings"
          disabled={!ready}
          onPress={() => {
            if (strikerId === null || nonStrikerId === null || bowlerId === null) return;
            startInnings(battingSide, { strikerId, nonStrikerId, bowlerId }, overs);
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
