const probs = [1, 8, 28, 56, 70, 56, 28, 8, 1].map((n) => n / 256)
const tables = {
  low: [3.2, 1.5, 1.2, 1.08, 0.58, 1.08, 1.2, 1.5, 3.2],
  medium: [9.5, 2.9, 1.3, 0.72, 0.48, 0.72, 1.3, 2.9, 9.5],
  high: [22, 4, 1.4, 0.4, 0.25, 0.4, 1.4, 4, 22],
}
for (const [k, m] of Object.entries(tables)) {
  const ev = m.reduce((s, v, i) => s + v * probs[i], 0)
  console.log(k, 'RTP=', ev.toFixed(4))
}
