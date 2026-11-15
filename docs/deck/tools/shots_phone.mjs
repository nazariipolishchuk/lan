// Phone screenshot of the demo field card (390x844 CSS px at 3x).
const OUT = 'C:/Work/SpaceXChallenge/docs/deck/raw'
export default async (p) => {
  await p.go('/?lang=en'); await p.eval('localStorage.setItem("lan.intro","1")')
  await p.go('/?lang=en#/f/8a9alcg08c'); await p.eval('location.reload()'); await p.sleep(9000)
  await p.shot(`${OUT}/phone-card.png`)
}
