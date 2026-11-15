// Desktop screenshots for the deck (1600x900 CSS px at 2x): map with drought layer, demo field card, comparison.
const OUT = 'C:/Work/SpaceXChallenge/docs/deck/raw'
export default async (p) => {
  await p.go('/?lang=en'); await p.eval('localStorage.setItem("lan.intro","1")')
  await p.eval('location.reload()'); await p.sleep(5000)
  await p.clickText('Drought'); await p.sleep(1200)
  for (let i = 0; i < 2; i++) { await p.wheel(1000, 520, 300); await p.sleep(700) }
  await p.sleep(6000)
  await p.shot(`${OUT}/map-drought.jpg`)
  await p.go('/?lang=en#/f/8a9alcg08c'); await p.eval('location.reload()'); await p.sleep(9000)
  await p.shot(`${OUT}/card.png`)
  await p.go('/?lang=en#/f/8a9alcg08c/compare'); await p.eval('location.reload()'); await p.sleep(9000)
  await p.shot(`${OUT}/compare.png`)
}
